import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { es } from "date-fns/locale";

import { dataLayerClient } from "@/services/dataLayerClient";
import { getDepartmentLabel } from "@/types/department";
import { buildReadableFilename, formatDateForFilename } from "@/utils/fileName";
import {
  getScheduledWorkDateKeys,
  resolveAssignmentWorkDateKeys,
  uniqueSortedDateKeys,
  type JobScheduleLike,
} from "@/utils/assignmentWorkDates";
import {
  createPdfExportDocument,
  drawCorporatePdfHeader,
  drawGeneratedPdfFooter,
  loadImageAsDataUrl,
} from "@/utils/pdf/exportHelpers";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";

const MADRID_TIME_ZONE = "Europe/Madrid";
const SECTOR_PRO_RED: [number, number, number] = [125, 1, 1];

type CrewReportJob = JobScheduleLike & {
  id: string;
  title?: string | null;
  location?: {
    name?: string | null;
    formatted_address?: string | null;
  } | null;
};

type CrewProfile = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  dni?: string | null;
  department?: string | null;
};

type CrewAssignmentRow = {
  id?: string | null;
  technician_id?: string | null;
  external_technician_name?: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  assignment_source?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  production_role?: string | null;
  profiles?: CrewProfile | CrewProfile[] | null;
};

type TimesheetDateRow = {
  technician_id: string | null;
  date: string | null;
};

type CrewReportPerson = {
  key: string;
  firstName: string;
  lastName: string;
  dni: string;
  departments: Set<string>;
  dateKeys: Set<string>;
};

export type ProjectCrewReportResult = {
  crewCount: number;
  filename: string;
};

const ASSIGNMENT_DEPARTMENTS: Array<[keyof CrewAssignmentRow, string]> = [
  ["sound_role", "sound"],
  ["lights_role", "lights"],
  ["video_role", "video"],
  ["production_role", "production"],
];

const normalizeProfile = (profile: CrewAssignmentRow["profiles"]): CrewProfile | null => {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
};

const cleanText = (value: unknown): string => String(value ?? "").trim();

const splitExternalName = (name: string): { firstName: string; lastName: string } => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const labelDepartment = (department: string | null | undefined): string => {
  const normalized = cleanText(department)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "produccion") return getDepartmentLabel("production");
  if (normalized === "iluminacion") return getDepartmentLabel("lights");
  if (normalized === "sonido") return getDepartmentLabel("sound");
  if (normalized === "logistica") return getDepartmentLabel("logistics");
  if (normalized === "administracion") return getDepartmentLabel("administrative");

  return getDepartmentLabel(department);
};

const getAssignmentDepartmentLabels = (assignment: CrewAssignmentRow, profile: CrewProfile | null): string[] => {
  const assignedDepartments = ASSIGNMENT_DEPARTMENTS
    .filter(([roleKey]) => Boolean(assignment[roleKey]))
    .map(([, department]) => labelDepartment(department));

  if (assignedDepartments.length > 0) {
    return Array.from(new Set(assignedDepartments));
  }

  return [labelDepartment(profile?.department)];
};

const formatDateKey = (dateKey: string): string => (
  formatInTimeZone(
    fromZonedTime(`${dateKey}T00:00:00`, MADRID_TIME_ZONE),
    MADRID_TIME_ZONE,
    "d MMM yyyy",
    { locale: es },
  )
);

const formatDateList = (dateKeys: Iterable<string>): string => {
  const dates = uniqueSortedDateKeys(dateKeys);
  if (dates.length === 0) return "Sin fecha";
  return dates.map(formatDateKey).join(", ");
};

const buildCrewReportFilename = (job: CrewReportJob): string =>
  buildReadableFilename([
    "informe personal",
    job.title || job.id,
    formatDateForFilename(job.start_time instanceof Date ? job.start_time : cleanText(job.start_time)),
  ]);

const inferPdfImageFormat = (dataUrl: string | null): "PNG" | "JPEG" => {
  if (!dataUrl) return "PNG";
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
};

const loadReportHeaderLogo = async (jobId: string): Promise<string | null> => {
  try {
    const logoUrl = await fetchJobLogo(jobId);
    if (!logoUrl) return null;
    return await loadImageAsDataUrl(logoUrl);
  } catch (error) {
    console.warn("Unable to load job logo for crew report:", error);
    return null;
  }
};

const getTimesheetDatesByTechnician = (timesheets: TimesheetDateRow[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();

  for (const timesheet of timesheets) {
    if (!timesheet.technician_id || !timesheet.date) continue;
    if (!map.has(timesheet.technician_id)) {
      map.set(timesheet.technician_id, new Set());
    }
    map.get(timesheet.technician_id)?.add(timesheet.date);
  }

  return map;
};

const buildCrewRows = ({
  assignments,
  jobScheduledDateKeys,
  timesheets,
}: {
  assignments: CrewAssignmentRow[];
  jobScheduledDateKeys: string[];
  timesheets: TimesheetDateRow[];
}): CrewReportPerson[] => {
  const timesheetDatesByTechnician = getTimesheetDatesByTechnician(timesheets);
  const grouped = new Map<string, CrewReportPerson>();

  for (const assignment of assignments) {
    const profile = normalizeProfile(assignment.profiles);
    const externalName = cleanText(assignment.external_technician_name);
    const splitName = externalName ? splitExternalName(externalName) : null;
    const firstName = cleanText(profile?.first_name) || splitName?.firstName || "";
    const lastName = cleanText(profile?.last_name) || splitName?.lastName || "";
    const dni = cleanText(profile?.dni);
    const technicianKey = assignment.technician_id
      ? `tech:${assignment.technician_id}`
      : `external:${externalName || assignment.id || `${firstName}:${lastName}`}`;

    if (!grouped.has(technicianKey)) {
      grouped.set(technicianKey, {
        key: technicianKey,
        firstName,
        lastName,
        dni,
        departments: new Set(),
        dateKeys: new Set(),
      });
    }

    const row = grouped.get(technicianKey)!;
    if (!row.firstName && firstName) row.firstName = firstName;
    if (!row.lastName && lastName) row.lastName = lastName;
    if (!row.dni && dni) row.dni = dni;

    getAssignmentDepartmentLabels(assignment, profile).forEach((department) => row.departments.add(department));

    const dateKeys = resolveAssignmentWorkDateKeys(
      {
        ...assignment,
        _scheduled_work_dates: jobScheduledDateKeys,
      },
      {
        scheduledDateKeys: jobScheduledDateKeys,
        timesheetDateKeys: assignment.technician_id
          ? timesheetDatesByTechnician.get(assignment.technician_id)
          : null,
      },
    );

    dateKeys.forEach((dateKey) => row.dateKeys.add(dateKey));
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const departmentCompare = Array.from(a.departments).join(", ").localeCompare(
      Array.from(b.departments).join(", "),
      "es",
    );
    if (departmentCompare !== 0) return departmentCompare;

    const lastNameCompare = a.lastName.localeCompare(b.lastName, "es");
    if (lastNameCompare !== 0) return lastNameCompare;

    return a.firstName.localeCompare(b.firstName, "es");
  });
};

const fetchCrewReportData = async (job: CrewReportJob) => {
  const [assignmentsResult, timesheetsResult, jobDateTypesResult] = await Promise.all([
    dataLayerClient
      .from("job_assignments")
      .select(`
        id,
        technician_id,
        external_technician_name,
        single_day,
        assignment_date,
        assignment_source,
        sound_role,
        lights_role,
        video_role,
        production_role,
        profiles!job_assignments_technician_id_fkey(
          id,
          first_name,
          last_name,
          nickname,
          dni,
          department
        )
      `)
      .eq("job_id", job.id)
      .order("assigned_at", { ascending: true }),
    dataLayerClient
      .from("timesheets")
      .select("technician_id, date")
      .eq("job_id", job.id)
      .eq("is_active", true),
    dataLayerClient
      .from("job_date_types")
      .select("date, type")
      .eq("job_id", job.id),
  ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (timesheetsResult.error) throw timesheetsResult.error;

  if (jobDateTypesResult.error) {
    console.warn("Unable to fetch job date types for crew report:", jobDateTypesResult.error);
  }

  const jobDateTypes = jobDateTypesResult.error ? job.job_date_types : jobDateTypesResult.data;
  const jobScheduledDateKeys = getScheduledWorkDateKeys({
    ...job,
    job_date_types: jobDateTypes || job.job_date_types || [],
  });

  return {
    crewRows: buildCrewRows({
      assignments: (assignmentsResult.data || []) as CrewAssignmentRow[],
      jobScheduledDateKeys,
      timesheets: (timesheetsResult.data || []) as TimesheetDateRow[],
    }),
    jobScheduledDateKeys,
  };
};

export const downloadProjectCrewReportPdf = async (job: CrewReportJob): Promise<ProjectCrewReportResult> => {
  const generatedAt = new Date();
  const [reportData, headerLogo] = await Promise.all([
    fetchCrewReportData(job),
    loadReportHeaderLogo(job.id),
  ]);
  const { crewRows, jobScheduledDateKeys } = reportData;
  const { pdf, autoTable } = await createPdfExportDocument({ orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.width;

  const eventDates = formatDateList(jobScheduledDateKeys);
  const locationName = cleanText(job.location?.name) || cleanText(job.location?.formatted_address) || "Sin ubicación";

  drawCorporatePdfHeader(pdf, {
    title: "Informe de Personal",
    subtitle: cleanText(job.title) || "Trabajo sin título",
    logo: headerLogo,
    logoFormat: inferPdfImageFormat(headerLogo),
  });

  pdf.setTextColor(35, 35, 35);
  pdf.setFontSize(10);
  pdf.text(`Ubicación: ${locationName}`, 14, 42);
  const dateLines = pdf.splitTextToSize(`Fechas del trabajo: ${eventDates}`, pageWidth - 28);
  pdf.text(dateLines, 14, 49);
  pdf.text(`Total personal: ${crewRows.length}`, pageWidth - 14, 42, { align: "right" });
  const tableStartY = Math.max(59, 49 + dateLines.length * 5 + 6);

  const body = crewRows.length > 0
    ? crewRows.map((row) => [
      formatDateList(row.dateKeys),
      row.firstName || "-",
      row.lastName || "-",
      row.dni || "-",
      Array.from(row.departments).join(", ") || "Sin departamento",
    ])
    : [["Sin personal asignado", "-", "-", "-", "-"]];

  autoTable(pdf, {
    head: [["Fechas programadas", "Nombre", "Apellidos", "DNI", "Departamento"]],
    body,
    startY: tableStartY,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: SECTOR_PRO_RED,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { cellWidth: 42 },
      2: { cellWidth: 54 },
      3: { cellWidth: 36 },
      4: { cellWidth: 42 },
    },
    margin: { left: 14, right: 14, bottom: 28 },
  });

  const pageCount = pdf.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber);
    drawGeneratedPdfFooter(pdf, {
      pageNumber,
      generatedAt,
    });
  }

  const filename = buildCrewReportFilename(job);
  pdf.save(filename);

  return {
    crewCount: crewRows.length,
    filename,
  };
};
