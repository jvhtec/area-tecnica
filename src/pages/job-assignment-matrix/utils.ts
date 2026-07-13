import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { dataLayerClient } from "@/services/dataLayerClient";
const MADRID_TIMEZONE = "Europe/Madrid";

function toMadridDateKey(date: Date): string {
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
}

function nextMadridDateKey(dateKey: string): string {
  const madridNoonUtc = fromZonedTime(`${dateKey}T12:00:00`, MADRID_TIMEZONE);
  return formatInTimeZone(addDays(madridNoonUtc, 1), MADRID_TIMEZONE, "yyyy-MM-dd");
}

export type MatrixJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  job_date_types?: Array<{ date: string; type: string }>;
  _assigned_count?: number;
};

type MatrixJobAssignment = {
  status?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  production_role?: string | null;
};

// Clean shapes for the rows these queries read. The typed Supabase client infers
// very complex types for these nested selects, so we assert the fields we use at
// the query boundary instead of threading the inferred relation types around.
type RawMatrixJobRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  job_date_types?: Array<{ date: string; type: string }>;
  job_assignments?: MatrixJobAssignment[];
};

type RawJobDateTypeRow = {
  jobs?: RawMatrixJobRow | RawMatrixJobRow[] | null;
};

type RawAssignmentJobRef = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
};

type RawAssignmentRow = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  single_day: boolean | null;
  assignment_date: string | null;
  status: string | null;
  assigned_at: string | null;
  jobs?: RawAssignmentJobRef | RawAssignmentJobRef[] | null;
};

type AssignmentQueryResult = { data: RawAssignmentRow[] | null; error: { message?: string } | null };

export type MatrixAssignment = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  single_day: boolean | null;
  assignment_date: string | null;
  status: string | null;
  assigned_at: string | null;
  job: MatrixJob | RawAssignmentJobRef | undefined;
};

type AvailabilityScheduleRow = { user_id: string; date: string; status: string; notes?: string | null; source?: string | null };
type LegacyAvailabilityRow = { technician_id: string; date: string; status: string };
type VacationRow = { technician_id: string; start_date: string | null; end_date: string | null; status: string };

/** Reads a Postgres error code off an unknown thrown value without using `any`. */
const errorCode = (error: unknown): string | undefined =>
  (error as { code?: string } | null | undefined)?.code;

const ROLE_FIELD_BY_DEPARTMENT = {
  sound: "sound_role",
  lights: "lights_role",
  video: "video_role",
  production: "production_role",
} as const;

function hasAssignedRole(role: string | null | undefined) {
  if (!role) return false;
  return role.trim().toLowerCase() !== "none";
}

export function countMatrixAssignmentsForDepartment(assignments: MatrixJobAssignment[], department: string) {
  const activeAssignments = assignments.filter((assignment) => {
    const status = (assignment.status || "").toLowerCase();
    return status !== "declined";
  });

  const roleField = ROLE_FIELD_BY_DEPARTMENT[department as keyof typeof ROLE_FIELD_BY_DEPARTMENT];
  if (!roleField) return activeAssignments.length;

  return activeAssignments.filter((assignment) => hasAssignedRole(assignment[roleField])).length;
}

export function shouldShowMatrixJob(job: Pick<MatrixJob, "status" | "_assigned_count">) {
  return job.status !== "Cancelado" || (job._assigned_count ?? 0) > 0;
}

export async function fetchJobsForWindow(start: Date, end: Date, department: string) {
  const windowRange = `[${start.toISOString()},${end.toISOString()}]`;
  const allowedJobTypes = ["single", "festival", "ciclo", "tourdate", "evento"] as const;

  let overlapQuery = dataLayerClient.from("jobs")
    .select(
      `
      id, title, start_time, end_time, color, status, job_type, job_date_types(date, type),
      job_departments!inner(department),
      job_assignments!job_id(technician_id, status, sound_role, lights_role, video_role, production_role)
    `
    )
    .filter("time_range", "ov", windowRange)
    .in("job_type", allowedJobTypes)
    .limit(500);

  if (department) {
    overlapQuery = overlapQuery.eq("job_departments.department", department);
  }

  let typedQuery = dataLayerClient.from("job_date_types")
    .select(
      `
      job_id,
      date,
      type,
      jobs!inner(
        id, title, start_time, end_time, color, status, job_type, job_date_types(date, type),
        job_departments!inner(department),
        job_assignments!job_id(technician_id, status, sound_role, lights_role, video_role, production_role)
      )
    `
    )
    .gte("date", formatInTimeZone(start, MADRID_TIMEZONE, "yyyy-MM-dd"))
    .lte("date", formatInTimeZone(end, MADRID_TIMEZONE, "yyyy-MM-dd"))
    .in("jobs.job_type", allowedJobTypes)
    .limit(500);

  if (department) {
    typedQuery = typedQuery.eq("jobs.job_departments.department", department);
  }

  const [overlapRes, typedRes] = await Promise.all([
    overlapQuery.order("start_time", { ascending: true }),
    typedQuery,
  ]);

  const { data: overlapData, error } = overlapRes;
  if (error) throw error;
  if (typedRes.error) throw typedRes.error;

  const mergedById = new Map<string, RawMatrixJobRow>();
  for (const row of (overlapData ?? []) as RawMatrixJobRow[]) {
    mergedById.set(row.id, row);
  }
  for (const typed of (typedRes.data ?? []) as RawJobDateTypeRow[]) {
    const job = Array.isArray(typed.jobs) ? typed.jobs[0] : typed.jobs;
    if (job?.id && !mergedById.has(job.id)) {
      mergedById.set(job.id, job);
    }
  }

  return Array.from(mergedById.values())
    .map((j) => {
      const assigns = Array.isArray(j.job_assignments) ? j.job_assignments : [];
      return {
        id: j.id,
        title: j.title,
        start_time: j.start_time,
        end_time: j.end_time,
        color: j.color,
        status: j.status,
        job_type: j.job_type,
        job_date_types: Array.isArray(j.job_date_types) ? j.job_date_types : [],
        _assigned_count: countMatrixAssignmentsForDepartment(assigns, department),
      } as MatrixJob;
    })
    .filter(shouldShowMatrixJob);
}

export async function fetchAssignmentsForWindow(
  jobIds: string[],
  technicianIds: string[],
  jobs: MatrixJob[],
): Promise<MatrixAssignment[]> {
  if (!jobIds.length || !technicianIds.length) return [];

  const jobsById = new Map<string, MatrixJob>();
  jobs.forEach((job) => {
    if (job?.id) jobsById.set(job.id, job);
  });

  const batchSize = 25;
  // The query builders are PromiseLike; the awaited result is asserted below.
  const promises = [];

  for (let i = 0; i < jobIds.length; i += batchSize) {
    const jobBatch = jobIds.slice(i, i + batchSize);
    promises.push(
      dataLayerClient.from("job_assignments")
        .select(
          `
          job_id,
          technician_id,
          sound_role,
          lights_role,
          video_role,
          production_role,
          single_day,
          assignment_date,
          status,
          assigned_at,
          jobs!job_id (
            id,
            title,
            start_time,
            end_time,
            color
          )
        `
        )
        .in("job_id", jobBatch)
        .in("technician_id", technicianIds)
        .limit(500)
    );
  }

  const results = (await Promise.all(promises)) as AssignmentQueryResult[];
  const allData = results.flatMap((result) => {
    if (result.error) {
      console.error("Assignment prefetch error:", result.error);
      return [] as RawAssignmentRow[];
    }
    return result.data || [];
  });

  return allData
    .map((item) => ({
      job_id: item.job_id,
      technician_id: item.technician_id,
      sound_role: item.sound_role,
      lights_role: item.lights_role,
      video_role: item.video_role,
      production_role: item.production_role,
      single_day: item.single_day,
      assignment_date: item.assignment_date,
      status: item.status,
      assigned_at: item.assigned_at,
      job: jobsById.get(item.job_id) || (Array.isArray(item.jobs) ? item.jobs[0] : item.jobs),
    }))
    .filter((item) => !!item.job);
}

export async function fetchAvailabilityForWindow(technicianIds: string[], start: Date, end: Date) {
  if (!technicianIds.length) return [] as Array<{ user_id: string; date: string; status: string; notes?: string }>;

  const techBatches: string[][] = [];
  const batchSize = 100;
  for (let i = 0; i < technicianIds.length; i += batchSize) {
    techBatches.push(technicianIds.slice(i, i + batchSize));
  }

  const perDay = new Map<string, { user_id: string; date: string; status: string; notes?: string }>();
  const startDateKey = toMadridDateKey(start);
  const endDateKey = toMadridDateKey(end);

  for (const batch of techBatches) {
    const { data: schedRows, error: schedErr } = await dataLayerClient.from("availability_schedules")
      .select("user_id, date, status, notes, source")
      .in("user_id", batch)
      .gte("date", startDateKey)
      .lte("date", endDateKey)
      .or("status.eq.unavailable,source.eq.vacation");
    if (schedErr) throw schedErr;
    ((schedRows ?? []) as AvailabilityScheduleRow[]).forEach((row) => {
      const key = `${row.user_id}-${row.date}`;
      if (!perDay.has(key)) {
        perDay.set(key, { user_id: row.user_id, date: row.date, status: "unavailable", notes: row.notes || undefined });
      } else if (row.notes) {
        const current = perDay.get(key)!;
        if (!current.notes) {
          perDay.set(key, { ...current, notes: row.notes });
        }
      }
    });
  }

  try {
    const { data: legacyRows, error: legacyErr } = await dataLayerClient.from("technician_availability")
      .select("technician_id, date, status")
      .in("technician_id", technicianIds)
      .gte("date", startDateKey)
      .lte("date", endDateKey)
      .in("status", ["vacation", "travel", "sick", "day_off"]);
    if (legacyErr) {
      if (legacyErr.code !== "42P01") throw legacyErr;
    }
    ((legacyRows ?? []) as LegacyAvailabilityRow[]).forEach((row) => {
      const key = `${row.technician_id}-${row.date}`;
      if (!perDay.has(key)) {
        perDay.set(key, { user_id: row.technician_id, date: row.date, status: "unavailable" });
      }
    });
  } catch (error: unknown) {
    const code = errorCode(error);
    if (code !== "42P01") throw error;
  }

  try {
    const vacBatchSize = 100;
    const vacBatches: string[][] = [];
    for (let i = 0; i < technicianIds.length; i += vacBatchSize) {
      vacBatches.push(technicianIds.slice(i, i + vacBatchSize));
    }
    for (const batch of vacBatches) {
      const { data: vacs, error: vacErr } = await dataLayerClient.from("vacation_requests")
        .select("technician_id, start_date, end_date, status")
        .eq("status", "approved")
        .in("technician_id", batch)
        .lte("start_date", endDateKey)
        .gte("end_date", startDateKey);
      if (vacErr) {
        if (vacErr.code !== "42P01") throw vacErr;
      }
      ((vacs ?? []) as VacationRow[]).forEach((vac) => {
        const vacationStart = String(vac.start_date ?? "");
        const vacationEnd = String(vac.end_date ?? "");
        if (!vacationStart || !vacationEnd) return;

        const clampStart = vacationStart > startDateKey ? vacationStart : startDateKey;
        const clampEnd = vacationEnd < endDateKey ? vacationEnd : endDateKey;
        if (clampStart > clampEnd) return;

        let dateKey = clampStart;
        while (dateKey <= clampEnd) {
          const key = `${vac.technician_id}-${dateKey}`;
          if (!perDay.has(key)) {
            perDay.set(key, { user_id: vac.technician_id, date: dateKey, status: "unavailable" });
          }
          const nextDateKey = nextMadridDateKey(dateKey);
          if (nextDateKey === dateKey) break;
          dateKey = nextDateKey;
        }
      });
    }
  } catch (error: unknown) {
    const code = errorCode(error);
    if (code !== "42P01") throw error;
  }

  return Array.from(perDay.values());
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  sound: "Sonido",
  lights: "Luces",
  video: "Video",
  production: "Producción",
  rigging: "Rigging",
  staging: "Escenario",
  backline: "Backline",
  power: "Energía",
};

export type StaffingSummaryRole = {
  role_code: string;
  quantity: number;
  notes?: string | null;
};

export type StaffingSummaryRow = {
  job_id: string;
  department: string;
  roles: StaffingSummaryRole[];
};

export type StaffingAssignmentRow = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  status: string | null;
};

export type StaffingScheduledRow = {
  job_id: string;
  technician_id: string;
  date: string;
};

export type OutstandingRoleInfo = {
  roleCode: string;
  required: number;
  assigned: number;
  outstanding: number;
};

export type OutstandingDepartmentInfo = {
  department: string;
  displayName: string;
  outstandingTotal: number;
  roles: OutstandingRoleInfo[];
};

export type OutstandingJobInfo = {
  jobId: string;
  jobTitle: string;
  outstandingTotal: number;
  departments: OutstandingDepartmentInfo[];
};

export const AVAILABLE_DEPARTMENTS = ["sound", "lights", "video", "production"] as const;
export type Department = (typeof AVAILABLE_DEPARTMENTS)[number];
export const FALLBACK_DEPARTMENT: Department = "sound";
export const OUTSTANDING_STORAGE_KEY = "job-assignment-matrix:last-outstanding-hash";

export function formatLabel(value: string) {
  return value
    .split(/[_\\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const MATRIX_STAFFING_SUMMARY_QUERY_SCOPE = "matrix-staffing-summary";

/**
 * Required-roles + actual assignments for a set of jobs, across every
 * department (not just the currently selected matrix tab). Shared by the
 * staffing reminder computation and the coverage heatmap lens so both read
 * from the same React Query cache entry instead of double-fetching.
 */
export async function fetchStaffingSummaryForJobs(
  jobIds: string[],
): Promise<{ summaries: StaffingSummaryRow[]; assignments: StaffingAssignmentRow[]; scheduled: StaffingScheduledRow[] }> {
  if (!jobIds.length) {
    return { summaries: [], assignments: [], scheduled: [] };
  }

  const fetchScheduledRows = async (): Promise<StaffingScheduledRow[]> => {
    const rows: StaffingScheduledRow[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await dataLayerClient.from("timesheets")
        .select("job_id, technician_id, date")
        .in("job_id", jobIds)
        .eq("is_active", true)
        .order("job_id", { ascending: true })
        .order("technician_id", { ascending: true })
        .order("date", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const page = (data || []) as StaffingScheduledRow[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows;
  };

  const [summaryRes, assignmentsRes, scheduled] = await Promise.all([
    dataLayerClient.from("job_required_roles_summary")
      .select("job_id, department, roles")
      .in("job_id", jobIds),
    dataLayerClient.from("job_assignments")
      .select("job_id, technician_id, sound_role, lights_role, video_role, production_role, status")
      .in("job_id", jobIds),
    fetchScheduledRows(),
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;

  const summaries = (summaryRes.data || [])
    .map(parseSummaryRow)
    .filter((row): row is StaffingSummaryRow => Boolean(row));

  const assignments = ((assignmentsRes.data || []) as StaffingAssignmentRow[])
    .filter((row): row is StaffingAssignmentRow => Boolean(row && row.job_id))
    .map((row) => ({
      ...row,
      sound_role: row.sound_role ? String(row.sound_role) : null,
      lights_role: row.lights_role ? String(row.lights_role) : null,
      video_role: row.video_role ? String(row.video_role) : null,
      status: row.status ? String(row.status) : null,
    }));

  return { summaries, assignments, scheduled };
}

export function parseSummaryRow(row: unknown): StaffingSummaryRow | null {
  const record = (row ?? null) as { job_id?: unknown; department?: unknown; roles?: unknown } | null;
  if (!record || typeof record.job_id !== "string" || typeof record.department !== "string") return null;
  const rawRoles = Array.isArray(record.roles) ? (record.roles as Array<Record<string, unknown>>) : [];
  const roles = rawRoles
    .map((r) => ({
      role_code: typeof r?.role_code === "string" ? r.role_code : String(r?.role_code ?? ""),
      quantity: Number(r?.quantity ?? 0),
      notes: typeof r?.notes === "string" ? r.notes : null,
    }))
    .filter((r: StaffingSummaryRole) => r.role_code);
  return {
    job_id: record.job_id,
    department: record.department,
    roles,
  };
}
