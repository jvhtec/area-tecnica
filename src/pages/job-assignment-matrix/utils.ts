import { format } from "date-fns";
import { supabase } from "@/lib/supabase";

export type MatrixJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  _assigned_count?: number;
};

export async function fetchJobsForWindow(start: Date, end: Date, department: string) {
  const windowRange = `[${start.toISOString()},${end.toISOString()}]`;
  let query = supabase
    .from("jobs")
    .select(
      `
      id, title, start_time, end_time, color, status, job_type,
      job_departments!inner(department),
      job_assignments!job_id(technician_id)
    `
    )
    .filter("time_range", "ov", windowRange)
    .in("job_type", ["single", "festival", "tourdate", "evento"])
    .limit(500);

  if (department) {
    query = query.eq("job_departments.department", department);
  }

  const { data, error } = await query.order("start_time", { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((j: any) => {
      const assigns = Array.isArray(j.job_assignments) ? j.job_assignments : [];
      return {
        id: j.id,
        title: j.title,
        start_time: j.start_time,
        end_time: j.end_time,
        color: j.color,
        status: j.status,
        job_type: j.job_type,
        _assigned_count: assigns.length as number,
      } as MatrixJob;
    })
    .filter((j) => j.status !== "Cancelado" || (j._assigned_count ?? 0) > 0);
}

export async function fetchAssignmentsForWindow(jobIds: string[], technicianIds: string[], jobs: MatrixJob[]) {
  if (!jobIds.length || !technicianIds.length) return [];

  const jobsById = new Map<string, MatrixJob>();
  jobs.forEach((job) => {
    if (job?.id) jobsById.set(job.id, job);
  });

  const batchSize = 25;
  const promises: any[] = [];

  for (let i = 0; i < jobIds.length; i += batchSize) {
    const jobBatch = jobIds.slice(i, i + batchSize);
    promises.push(
      supabase
        .from("job_assignments")
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

  const results = await Promise.all(promises);
  const allData = results.flatMap((result: any) => {
    if (result.error) {
      console.error("Assignment prefetch error:", result.error);
      return [];
    }
    return result.data || [];
  });

  return allData
    .map((item: any) => ({
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
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  for (const batch of techBatches) {
    const { data: schedRows, error: schedErr } = await supabase
      .from("availability_schedules")
      .select("user_id, date, status, notes, source")
      .in("user_id", batch)
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", format(end, "yyyy-MM-dd"))
      .or("status.eq.unavailable,source.eq.vacation");
    if (schedErr) throw schedErr;
    (schedRows || []).forEach((row: any) => {
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
    const { data: legacyRows, error: legacyErr } = await supabase
      .from("technician_availability")
      .select("technician_id, date, status")
      .in("technician_id", technicianIds)
      .gte("date", format(start, "yyyy-MM-dd"))
      .lte("date", format(end, "yyyy-MM-dd"))
      .in("status", ["vacation", "travel", "sick", "day_off"]);
    if (legacyErr) {
      if (legacyErr.code !== "42P01") throw legacyErr;
    }
    (legacyRows || []).forEach((row: any) => {
      const key = `${row.technician_id}-${row.date}`;
      if (!perDay.has(key)) {
        perDay.set(key, { user_id: row.technician_id, date: row.date, status: "unavailable" });
      }
    });
  } catch (error: any) {
    if (error?.code && error.code !== "42P01") throw error;
  }

  try {
    const vacBatchSize = 100;
    const vacBatches: string[][] = [];
    for (let i = 0; i < technicianIds.length; i += vacBatchSize) {
      vacBatches.push(technicianIds.slice(i, i + vacBatchSize));
    }
    for (const batch of vacBatches) {
      const { data: vacs, error: vacErr } = await supabase
        .from("vacation_requests")
        .select("technician_id, start_date, end_date, status")
        .eq("status", "approved")
        .in("technician_id", batch)
        .lte("start_date", format(end, "yyyy-MM-dd"))
        .gte("end_date", format(start, "yyyy-MM-dd"));
      if (vacErr) {
        if (vacErr.code !== "42P01") throw vacErr;
      }
      (vacs || []).forEach((vac: any) => {
        const s = new Date(vac.start_date);
        const e = new Date(vac.end_date);
        const clampStart = new Date(Math.max(startDay.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()));
        const clampEnd = new Date(Math.min(endDay.getTime(), new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()));
        for (let d = new Date(clampStart); d.getTime() <= clampEnd.getTime(); d.setDate(d.getDate() + 1)) {
          const key = `${vac.technician_id}-${format(d, "yyyy-MM-dd")}`;
          if (!perDay.has(key)) {
            perDay.set(key, { user_id: vac.technician_id, date: format(d, "yyyy-MM-dd"), status: "unavailable" });
          }
        }
      });
    }
  } catch (error: any) {
    if (error?.code && error.code !== "42P01") throw error;
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
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  status: string | null;
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

export function parseSummaryRow(row: any): StaffingSummaryRow | null {
  if (!row || !row.job_id || !row.department) return null;
  const rawRoles = Array.isArray(row.roles) ? row.roles : [];
  const roles = rawRoles
    .map((r: any) => ({
      role_code: typeof r?.role_code === "string" ? r.role_code : String(r?.role_code ?? ""),
      quantity: Number(r?.quantity ?? 0),
      notes: (r?.notes ?? null) as string | null,
    }))
    .filter((r: StaffingSummaryRole) => r.role_code);
  return {
    job_id: row.job_id as string,
    department: row.department as string,
    roles,
  };
}

