import { addDays, getDaysInMonth, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

import { dataLayerClient } from "@/services/dataLayerClient";



export const MADRID_TIMEZONE = "Europe/Madrid";
export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LOOKAHEAD_DAYS = 120;
export const PAYOUT_TO_SERVICE_LOOKBACK_DAYS = 90;
export const PAYOUT_TO_SERVICE_LOOKAHEAD_DAYS = 45;
// Keep URL length safely below PostgREST/proxy limits when using `.in(...)` filters.
export const FILTER_CHUNK_SIZE = 60;
export const MAX_PARALLEL_CHUNKS = 6;
export const MAX_TECH_IDS_IN_QUERY_FILTER = 100;

export interface JobLite {
  id: string;
  title: string | null;
  start_time: string | null;
}

export interface ProfileLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  role: string | null;
  autonomo: boolean | null;
}

export interface PayoutLite {
  job_id: string | null;
  technician_id: string | null;
  total_eur: number | null;
}

export interface TimesheetLite {
  job_id: string | null;
  technician_id: string | null;
  date: string | null;
}

export interface JobAssignmentInvoiceLite {
  job_id: string | null;
  technician_id: string | null;
  invoice_received_at: string | null;
  invoice_received_by: string | null;
}

export interface DueItem {
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

export interface DueGroup {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
  totalEur: number;
  items: DueItem[];
}

export interface DueData {
  generatedAt: Date;
  windowFrom: Date;
  windowTo: Date;
  groups: DueGroup[];
  totalEur: number;
  totalItems: number;
}

export interface PayoutEstimate {
  fromDate: Date;
  toDate: Date;
}

export interface FetchFortnightPayoutsDueParams {
  payoutFromInput: string;
  payoutToInput: string;
}

export type SortColumn =
  | "technicianName"
  | "department"
  | "jobDate"
  | "jobTitle"
  | "estimate"
  | "autonomo"
  | "totalEur";
export type SortDirection = "asc" | "desc";

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function fetchInChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return [];

  const chunks = chunkArray(ids, FILTER_CHUNK_SIZE);
  const results: T[][] = [];

  for (let index = 0; index < chunks.length; index += MAX_PARALLEL_CHUNKS) {
    const batch = chunks.slice(index, index + MAX_PARALLEL_CHUNKS);
    const batchResults = await Promise.all(batch.map((chunk) => fetchChunk(chunk)));
    results.push(...batchResults);
  }

  return results.flat();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLongDate(date: Date): string {
  return formatInTimeZone(date, MADRID_TIMEZONE, "d 'de' MMMM 'de' yyyy", { locale: es });
}

export function formatDateInputValue(date: Date): string {
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
}

export function parseDateInputValue(value: string, endOfDay = false): Date | null {
  if (!value || !DATE_ONLY_RE.test(value)) return null;
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return fromZonedTime(`${value}T${time}`, MADRID_TIMEZONE);
}

export function parseServiceDate(value?: string | null): Date | null {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) {
    return fromZonedTime(`${value}T12:00:00`, MADRID_TIMEZONE);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getEstimatedPayoutFromDate(serviceDate: Date): Date {
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

export function calculateEstimatedPayoutRange(serviceDates: Date[]): PayoutEstimate {
  if (serviceDates.length === 0) {
    throw new Error("calculateEstimatedPayoutRange requiere al menos una fecha de servicio");
  }

  const payoutDates = serviceDates.map(getEstimatedPayoutFromDate);
  const minTs = Math.min(...payoutDates.map((d) => d.getTime()));
  const maxTs = Math.max(...payoutDates.map((d) => d.getTime()));
  return { fromDate: new Date(minTs), toDate: new Date(maxTs) };
}

export function getFortnightFromDate(date: Date): Omit<DueGroup, "items" | "totalEur"> {
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

export function buildTechnicianName(profile: ProfileLite | undefined, fallbackId: string): string {
  if (!profile) return fallbackId;
  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return fullName || fallbackId;
}

export function compareText(left?: string | null, right?: string | null): number {
  const leftText = (left ?? "").trim();
  const rightText = (right ?? "").trim();
  return leftText.localeCompare(rightText, "es", { sensitivity: "base" });
}

export function compareJobDate(left: Date | null, right: Date | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.getTime() - right.getTime();
}

export function compareDueItems(
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

export function getMadridIsoWeekday(date: Date): number {
  return Number(formatInTimeZone(date, MADRID_TIMEZONE, "i"));
}

export function isFridayInMadrid(date: Date): boolean {
  return getMadridIsoWeekday(date) === 5;
}

export function moveToNearestFriday(date: Date): Date {
  const weekday = getMadridIsoWeekday(date); // ISO: 1=lunes ... 7=domingo
  const fridayIso = 5;
  const diffForward = (fridayIso - weekday + 7) % 7;
  const diffBackward = diffForward === 0 ? 0 : diffForward - 7;
  const bestDiff =
    Math.abs(diffBackward) <= Math.abs(diffForward) ? diffBackward : diffForward;
  return addDays(date, bestDiff);
}

export function getSuggestedPaymentWindow(startDate: Date): { fromDate: Date; toDate: Date } {
  const fromDate = startDate;
  const rawEndDate = addDays(fromDate, 5);
  const toDate = moveToNearestFriday(rawEndDate);
  return { fromDate, toDate };
}

export function formatPaymentWindowDate(date: Date): string {
  const fridayTag = isFridayInMadrid(date) ? " (viernes)" : "";
  return `${formatLongDate(date)}${fridayTag}`;
}

export function formatEstimateText(fromDate: Date, toDate: Date): string {
  if (fromDate.getTime() === toDate.getTime()) {
    return formatLongDate(fromDate);
  }
  return `${formatLongDate(fromDate)} - ${formatLongDate(toDate)}`;
}

export function formatAutonomoCellValue(isHouseTech: boolean, isAutonomo: boolean | null): string {
  if (isHouseTech) return "Empleado";
  if (isAutonomo === null) return "—";
  return isAutonomo ? "Sí" : "No";
}

export function isInvoiceApplicable(isHouseTech: boolean, isAutonomo: boolean | null): boolean {
  return !isHouseTech && isAutonomo === true;
}

export async function fetchFortnightPayoutsDue({
  payoutFromInput,
  payoutToInput,
}: FetchFortnightPayoutsDueParams): Promise<DueData> {
  const generatedAt = new Date();
  const payoutFrom = parseDateInputValue(payoutFromInput, false);
  const payoutTo = parseDateInputValue(payoutToInput, true);

  const safePayoutFrom = payoutFrom ?? generatedAt;
  const safePayoutTo = payoutTo ?? addDays(generatedAt, LOOKAHEAD_DAYS);
  const windowFrom = subDays(safePayoutFrom, PAYOUT_TO_SERVICE_LOOKBACK_DAYS);
  const windowTo = addDays(safePayoutTo, PAYOUT_TO_SERVICE_LOOKAHEAD_DAYS);

  const { data: jobsData, error: jobsError } = await dataLayerClient.from("jobs")
    .select("id, title, start_time")
    .gte("start_time", windowFrom.toISOString())
    .lte("start_time", windowTo.toISOString());

  if (jobsError) throw jobsError;

  const jobs = (jobsData ?? []) as JobLite[];
  if (jobs.length === 0) {
    return { generatedAt, windowFrom, windowTo, groups: [], totalEur: 0, totalItems: 0 };
  }

  const jobIds = jobs.map((job) => job.id);
  const payouts = await fetchInChunks<PayoutLite>(jobIds, async (jobIdChunk) => {
    const { data: payoutsData, error: payoutsError } = await dataLayerClient.from("v_job_tech_payout_2025")
      .select("job_id, technician_id, total_eur")
      .in("job_id", jobIdChunk)
      .gt("total_eur", 0);

    if (payoutsError) throw payoutsError;
    return (payoutsData ?? []) as PayoutLite[];
  });

  const validPayouts = payouts.filter(
    (row) => !!row.job_id && !!row.technician_id && Number(row.total_eur ?? 0) > 0
  );

  if (validPayouts.length === 0) {
    return { generatedAt, windowFrom, windowTo, groups: [], totalEur: 0, totalItems: 0 };
  }

  const technicianIds = Array.from(
    new Set(validPayouts.map((row) => row.technician_id).filter((value): value is string => !!value))
  );
  const relevantJobIds = Array.from(
    new Set(validPayouts.map((row) => row.job_id).filter((value): value is string => !!value))
  );
  const technicianSet = new Set(technicianIds);
  const payoutPairSet = new Set(
    validPayouts.map((row) => `${row.job_id as string}:${row.technician_id as string}`)
  );
  const shouldFilterTechniciansInQuery =
    technicianIds.length > 0 && technicianIds.length <= MAX_TECH_IDS_IN_QUERY_FILTER;

  const [timesheetsRaw, profiles, assignmentsRaw] = await Promise.all([
    fetchInChunks<TimesheetLite>(relevantJobIds, async (jobIdChunk) => {
      let query = dataLayerClient.from("timesheets")
        .select("job_id, technician_id, date")
        .in("job_id", jobIdChunk)
        .eq("approved_by_manager", true);
      if (shouldFilterTechniciansInQuery) {
        query = query.in("technician_id", technicianIds);
      }

      const { data: timesheetsData, error: timesheetsError } = await query;

      if (timesheetsError) throw timesheetsError;
      return (timesheetsData ?? []) as TimesheetLite[];
    }),
    fetchInChunks<ProfileLite>(technicianIds, async (techIdChunk) => {
      const { data: profilesData, error: profilesError } = await dataLayerClient.from("profiles")
        .select("id, first_name, last_name, department, role, autonomo")
        .in("id", techIdChunk);

      if (profilesError) throw profilesError;
      return (profilesData ?? []) as ProfileLite[];
    }),
    fetchInChunks<JobAssignmentInvoiceLite>(relevantJobIds, async (jobIdChunk) => {
      let query = dataLayerClient.from("job_assignments")
        .select("job_id, technician_id, invoice_received_at, invoice_received_by")
        .in("job_id", jobIdChunk);
      if (shouldFilterTechniciansInQuery) {
        query = query.in("technician_id", technicianIds);
      }

      const { data: assignmentsData, error: assignmentsError } = await query;

      if (assignmentsError) throw assignmentsError;
      return (assignmentsData ?? []) as JobAssignmentInvoiceLite[];
    }),
  ]);

  const timesheets = timesheetsRaw.filter(
    (row) => !!row.technician_id && technicianSet.has(row.technician_id)
  );

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

  for (const [key, dates] of serviceDatesByKey.entries()) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    serviceDatesByKey.set(key, dates);
  }

  const groupsByKey = new Map<string, DueGroup>();

  for (const row of validPayouts) {
    const jobId = row.job_id as string;
    const technicianId = row.technician_id as string;
    const totalEur = Number(row.total_eur ?? 0);
    if (totalEur <= 0) continue;

    const job = jobsById.get(jobId);
    const serviceKey = `${jobId}:${technicianId}`;
    const serviceDates = serviceDatesByKey.get(serviceKey) ?? [];
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
