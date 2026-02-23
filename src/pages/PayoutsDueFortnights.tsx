import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, getDaysInMonth, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { AlertTriangle, CalendarDays, FileDown, Loader2, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { supabase } from "@/integrations/supabase/client";
import { createQueryKey } from "@/lib/optimized-react-query";
import { downloadPayoutDueGroupPdf } from "@/utils/payout-due-pdf";

const MADRID_TIMEZONE = "Europe/Madrid";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOOKBACK_DAYS = 365;
const LOOKAHEAD_DAYS = 120;
// Keep URL length safely below PostgREST/proxy limits when using `.in(...)` filters.
const FILTER_CHUNK_SIZE = 25;

interface JobLite {
  id: string;
  title: string | null;
  start_time: string | null;
}

interface ProfileLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  department: string | null;
  role: string | null;
  autonomo: boolean | null;
}

interface PayoutLite {
  job_id: string | null;
  technician_id: string | null;
  total_eur: number | null;
}

interface TimesheetLite {
  job_id: string | null;
  technician_id: string | null;
  date: string | null;
}

interface JobAssignmentInvoiceLite {
  job_id: string | null;
  technician_id: string | null;
  invoice_received_at: string | null;
  invoice_received_by: string | null;
}

interface DueItem {
  key: string;
  jobId: string;
  jobTitle: string;
  jobDate: Date | null;
  technicianId: string;
  technicianName: string;
  department: string | null;
  isHouseTech: boolean;
  isAutonomo: boolean | null;
  invoiceReceivedAt: string | null;
  totalEur: number;
  fromDate: Date;
  toDate: Date;
}

interface DueGroup {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
  totalEur: number;
  items: DueItem[];
}

interface DueData {
  generatedAt: Date;
  windowFrom: Date;
  windowTo: Date;
  groups: DueGroup[];
  totalEur: number;
  totalItems: number;
}

interface PayoutEstimate {
  fromDate: Date;
  toDate: Date;
}

type SortColumn =
  | "technicianName"
  | "department"
  | "jobDate"
  | "jobTitle"
  | "estimate"
  | "autonomo"
  | "totalEur";
type SortDirection = "asc" | "desc";

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLongDate(date: Date): string {
  return formatInTimeZone(date, MADRID_TIMEZONE, "d 'de' MMMM 'de' yyyy", { locale: es });
}

function formatDateInputValue(date: Date): string {
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
}

function parseDateInputValue(value: string, endOfDay = false): Date | null {
  if (!value || !DATE_ONLY_RE.test(value)) return null;
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return fromZonedTime(`${value}T${time}`, MADRID_TIMEZONE);
}

function parseServiceDate(value?: string | null): Date | null {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) {
    return fromZonedTime(`${value}T12:00:00`, MADRID_TIMEZONE);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getEstimatedPayoutFromDate(serviceDate: Date): Date {
  const madridDateStr = formatInTimeZone(serviceDate, MADRID_TIMEZONE, "yyyy-MM-dd");
  const [yearStr, monthStr, dayStr] = madridDateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const lastDayOfMonth = getDaysInMonth(new Date(year, month - 1, 1));
  const closingDay = day <= 15 ? 15 : lastDayOfMonth;
  const closingDateStr = `${yearStr}-${monthStr}-${String(closingDay).padStart(2, "0")}T12:00:00`;
  const periodClosingDate = fromZonedTime(closingDateStr, MADRID_TIMEZONE);
  return addDays(periodClosingDate, 30);
}

function calculateEstimatedPayoutRange(serviceDates: Date[]): PayoutEstimate {
  if (serviceDates.length === 0) {
    throw new Error("calculateEstimatedPayoutRange requiere al menos una fecha de servicio");
  }

  const payoutDates = serviceDates.map(getEstimatedPayoutFromDate);
  const minTs = Math.min(...payoutDates.map((d) => d.getTime()));
  const maxTs = Math.max(...payoutDates.map((d) => d.getTime()));
  return { fromDate: new Date(minTs), toDate: new Date(maxTs) };
}

function getFortnightFromDate(date: Date): Omit<DueGroup, "items" | "totalEur"> {
  const madridDateStr = formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
  const [yearStr, monthStr, dayStr] = madridDateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const lastDay = getDaysInMonth(new Date(year, month - 1, 1));
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : lastDay;
  const slot = day <= 15 ? "first" : "second";
  const startDate = fromZonedTime(
    `${yearStr}-${monthStr}-${String(startDay).padStart(2, "0")}T00:00:00`,
    MADRID_TIMEZONE
  );
  const endDate = fromZonedTime(
    `${yearStr}-${monthStr}-${String(endDay).padStart(2, "0")}T23:59:59`,
    MADRID_TIMEZONE
  );
  const monthLabel = formatInTimeZone(startDate, MADRID_TIMEZONE, "LLLL yyyy", { locale: es });
  return {
    key: `${yearStr}-${monthStr}-${slot}`,
    label: `${startDay}-${endDay} ${monthLabel}`,
    startDate,
    endDate,
  };
}

function buildTechnicianName(profile: ProfileLite | undefined, fallbackId: string): string {
  if (!profile) return fallbackId;
  const nickname = profile.nickname?.trim();
  if (nickname) return nickname;
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return fullName || fallbackId;
}

function compareText(left?: string | null, right?: string | null): number {
  const leftText = (left ?? "").trim();
  const rightText = (right ?? "").trim();
  return leftText.localeCompare(rightText, "es", { sensitivity: "base" });
}

function compareJobDate(left: Date | null, right: Date | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.getTime() - right.getTime();
}

function compareDueItems(
  left: DueItem,
  right: DueItem,
  sortColumn: SortColumn,
  sortDirection: SortDirection
): number {
  let result = 0;

  switch (sortColumn) {
    case "technicianName":
      result = compareText(left.technicianName, right.technicianName);
      if (result === 0) {
        result = compareText(left.department, right.department);
      }
      break;
    case "department":
      result = compareText(left.department, right.department);
      if (result === 0) {
        result = compareJobDate(left.jobDate, right.jobDate);
      }
      break;
    case "jobDate":
      result = compareJobDate(left.jobDate, right.jobDate);
      if (result === 0) {
        result = compareText(left.department, right.department);
      }
      break;
    case "jobTitle":
      result = compareText(left.jobTitle, right.jobTitle);
      break;
    case "estimate":
      result = left.fromDate.getTime() - right.fromDate.getTime();
      if (result === 0) {
        result = left.toDate.getTime() - right.toDate.getTime();
      }
      break;
    case "autonomo":
      result = compareText(
        formatAutonomoCellValue(left.isHouseTech, left.isAutonomo),
        formatAutonomoCellValue(right.isHouseTech, right.isAutonomo)
      );
      break;
    case "totalEur":
      result = left.totalEur - right.totalEur;
      break;
    default:
      result = 0;
      break;
  }

  if (result === 0) {
    result = compareJobDate(left.jobDate, right.jobDate);
  }
  if (result === 0) {
    result = compareText(left.technicianName, right.technicianName);
  }
  if (result === 0) {
    result = compareText(left.department, right.department);
  }
  if (result === 0) {
    result = compareText(left.jobTitle, right.jobTitle);
  }

  return sortDirection === "asc" ? result : -result;
}

function getMadridIsoWeekday(date: Date): number {
  return Number(formatInTimeZone(date, MADRID_TIMEZONE, "i"));
}

function isFridayInMadrid(date: Date): boolean {
  return getMadridIsoWeekday(date) === 5;
}

function moveToNearestFriday(date: Date): Date {
  const weekday = getMadridIsoWeekday(date); // ISO: 1=lunes ... 7=domingo
  const fridayIso = 5;
  const diffForward = (fridayIso - weekday + 7) % 7;
  const diffBackward = diffForward === 0 ? 0 : diffForward - 7;
  const bestDiff =
    Math.abs(diffBackward) <= Math.abs(diffForward) ? diffBackward : diffForward;
  return addDays(date, bestDiff);
}

function getSuggestedPaymentWindow(startDate: Date): { fromDate: Date; toDate: Date } {
  const fromDate = startDate;
  const rawEndDate = addDays(fromDate, 5);
  const toDate = moveToNearestFriday(rawEndDate);
  return { fromDate, toDate };
}

function formatPaymentWindowDate(date: Date): string {
  const fridayTag = isFridayInMadrid(date) ? " (viernes)" : "";
  return `${formatLongDate(date)}${fridayTag}`;
}

function formatEstimateText(fromDate: Date, toDate: Date): string {
  if (fromDate.getTime() === toDate.getTime()) {
    return formatLongDate(fromDate);
  }
  return `${formatLongDate(fromDate)} - ${formatLongDate(toDate)}`;
}

function normalizeDepartmentKey(value?: string | null): string {
  return (
    value
      ?.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") ?? ""
  );
}

function formatAutonomoCellValue(isHouseTech: boolean, isAutonomo: boolean | null): string {
  if (isHouseTech) return "Empleado";
  if (isAutonomo === null) return "—";
  return isAutonomo ? "Sí" : "No";
}

function isInvoiceApplicable(isHouseTech: boolean, isAutonomo: boolean | null): boolean {
  return !isHouseTech && isAutonomo === true;
}

async function fetchFortnightPayoutsDue(): Promise<DueData> {
  const generatedAt = new Date();
  const windowFrom = subDays(generatedAt, LOOKBACK_DAYS);
  const windowTo = addDays(generatedAt, LOOKAHEAD_DAYS);

  const { data: jobsData, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, start_time")
    .gte("start_time", windowFrom.toISOString())
    .lte("start_time", windowTo.toISOString());

  if (jobsError) throw jobsError;

  const jobs = (jobsData ?? []) as JobLite[];
  if (jobs.length === 0) {
    return { generatedAt, windowFrom, windowTo, groups: [], totalEur: 0, totalItems: 0 };
  }

  const jobIds = jobs.map((job) => job.id);
  const payouts: PayoutLite[] = [];
  for (const jobIdChunk of chunkArray(jobIds, FILTER_CHUNK_SIZE)) {
    const { data: payoutsData, error: payoutsError } = await supabase
      .from("v_job_tech_payout_2025")
      .select("job_id, technician_id, total_eur")
      .in("job_id", jobIdChunk)
      .gt("total_eur", 0);

    if (payoutsError) throw payoutsError;
    payouts.push(...((payoutsData ?? []) as PayoutLite[]));
  }

  const validPayouts = payouts.filter(
    (row) => !!row.job_id && !!row.technician_id && Number(row.total_eur ?? 0) > 0
  );

  if (validPayouts.length === 0) {
    return { generatedAt, windowFrom, windowTo, groups: [], totalEur: 0, totalItems: 0 };
  }

  const technicianIds = Array.from(
    new Set(validPayouts.map((row) => row.technician_id).filter((value): value is string => !!value))
  );
  const technicianSet = new Set(technicianIds);
  const payoutPairSet = new Set(
    validPayouts.map((row) => `${row.job_id as string}:${row.technician_id as string}`)
  );

  const timesheetsRaw: TimesheetLite[] = [];
  for (const jobIdChunk of chunkArray(jobIds, FILTER_CHUNK_SIZE)) {
    const { data: timesheetsData, error: timesheetsError } = await supabase
      .from("timesheets")
      .select("job_id, technician_id, date")
      .in("job_id", jobIdChunk)
      .eq("approved_by_manager", true);

    if (timesheetsError) throw timesheetsError;
    timesheetsRaw.push(...((timesheetsData ?? []) as TimesheetLite[]));
  }
  const timesheets = timesheetsRaw.filter(
    (row) => !!row.technician_id && technicianSet.has(row.technician_id)
  );

  const profiles: ProfileLite[] = [];
  for (const techIdChunk of chunkArray(technicianIds, FILTER_CHUNK_SIZE)) {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, nickname, department, role, autonomo")
      .in("id", techIdChunk);

    if (profilesError) throw profilesError;
    profiles.push(...((profilesData ?? []) as ProfileLite[]));
  }

  const assignmentsRaw: JobAssignmentInvoiceLite[] = [];
  for (const jobIdChunk of chunkArray(jobIds, FILTER_CHUNK_SIZE)) {
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("job_assignments")
      .select("job_id, technician_id, invoice_received_at, invoice_received_by")
      .in("job_id", jobIdChunk);

    if (assignmentsError) throw assignmentsError;
    assignmentsRaw.push(...((assignmentsData ?? []) as JobAssignmentInvoiceLite[]));
  }

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const assignmentsByKey = new Map<string, JobAssignmentInvoiceLite>();
  const serviceDatesByKey = new Map<string, Date[]>();

  for (const row of assignmentsRaw) {
    if (!row.job_id || !row.technician_id) continue;
    if (!technicianSet.has(row.technician_id)) continue;
    const key = `${row.job_id}:${row.technician_id}`;
    if (!payoutPairSet.has(key)) continue;
    assignmentsByKey.set(key, row);
  }

  for (const row of timesheets) {
    if (!row.job_id || !row.technician_id) continue;
    const parsed = parseServiceDate(row.date);
    if (!parsed) continue;
    const key = `${row.job_id}:${row.technician_id}`;
    const existing = serviceDatesByKey.get(key) ?? [];
    existing.push(parsed);
    serviceDatesByKey.set(key, existing);
  }

  const groupsByKey = new Map<string, DueGroup>();

  for (const row of validPayouts) {
    const jobId = row.job_id as string;
    const technicianId = row.technician_id as string;
    const totalEur = Number(row.total_eur ?? 0);
    if (totalEur <= 0) continue;

    const job = jobsById.get(jobId);
    const serviceKey = `${jobId}:${technicianId}`;
    const serviceDates = [...(serviceDatesByKey.get(serviceKey) ?? [])].sort(
      (a, b) => a.getTime() - b.getTime()
    );
    const fallbackDate = parseServiceDate(job?.start_time ?? null);
    const estimateSourceDates = serviceDates.length > 0 ? serviceDates : fallbackDate ? [fallbackDate] : [];
    if (estimateSourceDates.length === 0) continue;

    const { fromDate, toDate } = calculateEstimatedPayoutRange(estimateSourceDates);
    const fortnight = getFortnightFromDate(fromDate);
    const profile = profilesById.get(technicianId);
    const assignment = assignmentsByKey.get(serviceKey);
    const technicianName = buildTechnicianName(profile, technicianId);

    const item: DueItem = {
      key: `${jobId}:${technicianId}`,
      jobId,
      jobTitle: job?.title?.trim() || "Evento sin título",
      jobDate: fallbackDate,
      technicianId,
      technicianName,
      department: profile?.department ?? null,
      isHouseTech: profile?.role === "house_tech",
      isAutonomo: profile?.autonomo ?? null,
      invoiceReceivedAt: assignment?.invoice_received_at ?? null,
      totalEur,
      fromDate,
      toDate,
    };

    const existingGroup = groupsByKey.get(fortnight.key);
    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.totalEur += totalEur;
      continue;
    }

    groupsByKey.set(fortnight.key, {
      ...fortnight,
      totalEur,
      items: [item],
    });
  }

  const groups = Array.from(groupsByKey.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const dateDelta = a.fromDate.getTime() - b.fromDate.getTime();
        if (dateDelta !== 0) return dateDelta;
        return b.totalEur - a.totalEur;
      }),
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const totalEur = groups.reduce((sum, group) => sum + group.totalEur, 0);
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);
  return { generatedAt, windowFrom, windowTo, groups, totalEur, totalItems };
}

export default function PayoutsDueFortnights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, userRole, userDepartment } = useOptimizedAuth();
  const todayInput = formatDateInputValue(new Date());
  const [searchText, setSearchText] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [fromDateFilter, setFromDateFilter] = useState(todayInput);
  const [toDateFilter, setToDateFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("jobDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [printingGroupKey, setPrintingGroupKey] = useState<string | null>(null);
  const [updatingInvoiceKeys, setUpdatingInvoiceKeys] = useState<Record<string, boolean>>({});

  const normalizedDepartment = normalizeDepartmentKey(userDepartment);
  const canManageInvoice =
    userRole === "admin" ||
    (userRole === "management" &&
      (normalizedDepartment === "administrative" || normalizedDepartment === "administracion"));

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: createQueryKey.payoutDueFortnights.all,
    queryFn: fetchFortnightPayoutsDue,
    staleTime: 60_000,
  });

  const invoiceMutation = useMutation({
    mutationFn: async ({
      jobId,
      technicianId,
      received,
    }: {
      jobId: string;
      technicianId: string;
      received: boolean;
    }) => {
      const receivedAt = received ? new Date().toISOString() : null;
      const receivedBy = received ? user?.id ?? null : null;

      const { data: updatedRows, error: updateError } = await supabase
        .from("job_assignments")
        .update({
          invoice_received_at: receivedAt,
          invoice_received_by: receivedBy,
        })
        .eq("job_id", jobId)
        .eq("technician_id", technicianId)
        .select("id");

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("No se encontró la asignación para marcar la factura.");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: createQueryKey.payoutDueFortnights.all });
    },
  });

  const nowTs = Date.now();
  const availableDepartments = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set(
        data.groups
          .flatMap((group) => group.items.map((item) => item.department))
          .filter((department): department is string => Boolean(department))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return null;
    const text = searchText.trim().toLowerCase();
    const fromDate = parseDateInputValue(fromDateFilter, false);
    const toDate = parseDateInputValue(toDateFilter, true);

    const groups = data.groups
      .map((group) => {
        const items = group.items.filter((item) => {
          if (departmentFilter !== "all" && item.department !== departmentFilter) {
            return false;
          }

          if (text) {
            const haystack = `${item.technicianName} ${item.jobTitle}`.toLowerCase();
            if (!haystack.includes(text)) {
              return false;
            }
          }

          // Keep items whose estimated range overlaps the selected date window.
          if (fromDate && item.toDate.getTime() < fromDate.getTime()) {
            return false;
          }
          if (toDate && item.fromDate.getTime() > toDate.getTime()) {
            return false;
          }

          return true;
        });

        if (items.length === 0) return null;
        const sortedItems = [...items].sort((left, right) =>
          compareDueItems(left, right, sortColumn, sortDirection)
        );
        return {
          ...group,
          items: sortedItems,
          totalEur: sortedItems.reduce((sum, item) => sum + item.totalEur, 0),
        };
      })
      .filter((group): group is DueGroup => group !== null);

    return {
      groups,
      totalEur: groups.reduce((sum, group) => sum + group.totalEur, 0),
      totalItems: groups.reduce((sum, group) => sum + group.items.length, 0),
    };
  }, [data, searchText, departmentFilter, fromDateFilter, toDateFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  };

  const getSortIndicator = (column: SortColumn): string => {
    if (sortColumn !== column) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleToggleInvoice = async (item: DueItem, received: boolean) => {
    if (!isInvoiceApplicable(item.isHouseTech, item.isAutonomo)) return;
    if (!canManageInvoice) return;
    if (!user?.id && received) {
      toast({
        title: "No se pudo actualizar",
        description: "No se encontró el usuario autenticado para registrar la factura.",
        variant: "destructive",
      });
      return;
    }

    setUpdatingInvoiceKeys((prev) => ({ ...prev, [item.key]: true }));
    try {
      await invoiceMutation.mutateAsync({
        jobId: item.jobId,
        technicianId: item.technicianId,
        received,
      });
      toast({
        title: received ? "Factura marcada" : "Factura desmarcada",
        description: `${item.technicianName} · ${item.jobTitle}`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar la factura.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setUpdatingInvoiceKeys((prev) => {
        const { [item.key]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handlePrintGroup = async (group: DueGroup) => {
    const paymentWindow = getSuggestedPaymentWindow(group.startDate);
    setPrintingGroupKey(group.key);
    try {
      await downloadPayoutDueGroupPdf({
        paymentFrom: paymentWindow.fromDate,
        paymentTo: paymentWindow.toDate,
        totalEur: group.totalEur,
        rows: group.items.map((item) => ({
          jobId: item.jobId,
          technicianName: item.technicianName,
          department: item.department,
          isHouseTech: item.isHouseTech,
          isAutonomo: item.isAutonomo,
          invoiceReceivedAt: item.invoiceReceivedAt,
          jobDate: item.jobDate,
          jobTitle: item.jobTitle,
          estimateText: formatEstimateText(item.fromDate, item.toDate),
          totalEur: item.totalEur,
        })),
      });
      toast({ title: "PDF generado", description: "La tabla se descargó correctamente." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo generar el PDF.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setPrintingGroupKey(null);
    }
  };

  const overdueItems = useMemo(() => {
    if (!filteredData) return 0;
    return filteredData.groups.reduce(
      (sum, group) => sum + group.items.filter((item) => item.toDate.getTime() < nowTs).length,
      0
    );
  }, [filteredData, nowTs]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="h-5 w-[520px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : "No se pudo cargar la previsión de pagos.";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Error cargando pagos previstos
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline">
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || !filteredData || filteredData.totalItems === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Pagos previstos por quincena</h1>
          <p className="text-sm text-muted-foreground">
            Estimación basada en partes aprobados y en la regla de pago quincenal (+30 días desde cierre de período).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>
              Por defecto se muestran pagos desde hoy; puedes buscar hacia atrás cambiando la fecha "Desde".
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payout-search">Buscar</Label>
              <Input
                id="payout-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Técnico o evento..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-from-date">Desde</Label>
              <Input
                id="payout-from-date"
                type="date"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-to-date">Hasta</Label>
              <Input
                id="payout-to-date"
                type="date"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableDepartments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => setFromDateFilter(todayInput)}
              >
                Desde hoy
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchText("");
                  setDepartmentFilter("all");
                  setFromDateFilter(todayInput);
                  setToDateFilter("");
                }}
              >
                Restablecer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sin resultados</CardTitle>
            <CardDescription>
              No hay pagos estimados para los filtros seleccionados.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Pagos previstos por quincena</h1>
        <p className="text-sm text-muted-foreground">
          Estimación basada en partes aprobados y en la regla de pago quincenal (+30 días desde cierre de período).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Total filtrado
            </CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(filteredData.totalEur)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {filteredData.totalItems} pagos agrupados en {filteredData.groups.length} quincenas.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Ventana analizada
            </CardDescription>
            <CardTitle className="text-base">
              {formatLongDate(data.windowFrom)} - {formatLongDate(data.windowTo)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Generado el {formatLongDate(data.generatedAt)}.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Vencidos
            </CardDescription>
            <CardTitle className="text-2xl">{overdueItems}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pagos cuyo rango estimado terminó antes de hoy.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Por defecto se muestran pagos desde hoy; puedes buscar hacia atrás cambiando la fecha "Desde".
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="payout-search">Buscar</Label>
            <Input
              id="payout-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Técnico o evento..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-from-date">Desde</Label>
            <Input
              id="payout-from-date"
              type="date"
              value={fromDateFilter}
              onChange={(event) => setFromDateFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payout-to-date">Hasta</Label>
            <Input
              id="payout-to-date"
              type="date"
              value={toDateFilter}
              onChange={(event) => setToDateFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {availableDepartments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="outline"
              onClick={() => setFromDateFilter(todayInput)}
            >
              Desde hoy
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchText("");
                setDepartmentFilter("all");
                setFromDateFilter(todayInput);
                setToDateFilter("");
              }}
            >
              Restablecer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredData.groups.map((group) => {
          const isPastFortnight = group.endDate.getTime() < nowTs;
          const paymentWindow = getSuggestedPaymentWindow(group.startDate);
          return (
            <Card key={group.key}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      A pagar entre {formatPaymentWindowDate(paymentWindow.fromDate)} y{" "}
                      {formatPaymentWindowDate(paymentWindow.toDate)}
                    </CardTitle>
                    <CardDescription>
                      {group.items.length} pagos · {formatCurrency(group.totalEur)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintGroup(group)}
                      disabled={printingGroupKey === group.key}
                    >
                      {printingGroupKey === group.key ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                      )}
                      Imprimir PDF
                    </Button>
                    <Badge variant={isPastFortnight ? "destructive" : "secondary"}>
                      {isPastFortnight ? "Vencida" : "Activa/Futura"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table className="table-fixed">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[22%]" />
                    <col className="w-[14%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("technicianName")}
                        >
                          Técnico {getSortIndicator("technicianName")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("department")}
                        >
                          Departamento {getSortIndicator("department")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("jobDate")}
                        >
                          Fecha del evento {getSortIndicator("jobDate")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("jobTitle")}
                        >
                          Evento {getSortIndicator("jobTitle")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("estimate")}
                        >
                          Estimación {getSortIndicator("estimate")}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-8 px-2"
                          onClick={() => handleSort("autonomo")}
                        >
                          Autónomo {getSortIndicator("autonomo")}
                        </Button>
                      </TableHead>
                      <TableHead>Factura recibida</TableHead>
                      <TableHead className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleSort("totalEur")}
                        >
                          Total {getSortIndicator("totalEur")}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item) => {
                      const estimateText = formatEstimateText(item.fromDate, item.toDate);
                      const invoiceApplicable = isInvoiceApplicable(item.isHouseTech, item.isAutonomo);
                      const invoiceReceived = Boolean(item.invoiceReceivedAt);
                      const invoiceUpdatedAtText = item.invoiceReceivedAt
                        ? formatInTimeZone(new Date(item.invoiceReceivedAt), MADRID_TIMEZONE, "dd/MM/yyyy")
                        : "";
                      const isUpdatingInvoice = Boolean(updatingInvoiceKeys[item.key]);
                      return (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">{item.technicianName}</TableCell>
                          <TableCell>{item.department || "—"}</TableCell>
                          <TableCell>{item.jobDate ? formatLongDate(item.jobDate) : "Fecha desconocida"}</TableCell>
                          <TableCell>{item.jobTitle}</TableCell>
                          <TableCell>{estimateText}</TableCell>
                          <TableCell>{formatAutonomoCellValue(item.isHouseTech, item.isAutonomo)}</TableCell>
                          <TableCell>
                            {!invoiceApplicable ? (
                              null
                            ) : canManageInvoice ? (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={invoiceReceived}
                                  disabled={isUpdatingInvoice}
                                  onCheckedChange={(checked) =>
                                    handleToggleInvoice(item, checked === true)
                                  }
                                  aria-label={`Factura recibida para ${item.technicianName}`}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {invoiceReceived ? invoiceUpdatedAtText : ""}
                                </span>
                              </div>
                            ) : (
                              invoiceReceived ? `Sí (${invoiceUpdatedAtText})` : "No"
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalEur)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
