import type { MatrixJob, MatrixTimesheetAssignment } from "@/hooks/useOptimizedMatrixData";

/**
 * Apply a colleague's change to the cached assignment matrix the moment its
 * realtime event arrives, instead of waiting for the refetch it also triggers
 * (several batched queries, so a visible delay). The refetch still runs and
 * remains the source of truth; these patches only cover the changes a payload
 * fully describes, and return null for anything they cannot apply exactly.
 */

type Row = Record<string, unknown>;

export interface RealtimeChange {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  new?: Row | null;
  old?: Row | null;
}

/** What one cached matrix query covers, read off its query key. */
export interface MatrixQueryScope {
  jobsById: Map<string, MatrixJob>;
  technicianIds: Set<string>;
  startKey: string;
  endKey: string;
}

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const boolOrNull = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const sameCell = (row: MatrixTimesheetAssignment, jobId: string, technicianId: string, date: string) =>
  row.job_id === jobId && row.technician_id === technicianId && row.date === date;

/** timesheets: one row per technician, job and Madrid day. */
export function applyTimesheetChange(
  rows: MatrixTimesheetAssignment[],
  change: RealtimeChange,
  scope: MatrixQueryScope,
): MatrixTimesheetAssignment[] | null {
  if (change.eventType === "DELETE") {
    // Without REPLICA IDENTITY FULL a delete only carries the id; the refetch
    // handles it.
    const old = change.old ?? {};
    const jobId = str(old.job_id);
    const technicianId = str(old.technician_id);
    const date = str(old.date);
    if (!jobId || !technicianId || !date) return null;
    const next = rows.filter((row) => !sameCell(row, jobId, technicianId, date));
    return next.length === rows.length ? rows : next;
  }

  const row = change.new ?? {};
  const jobId = str(row.job_id);
  const technicianId = str(row.technician_id);
  const date = str(row.date);
  if (!jobId || !technicianId || !date) return null;

  if (row.is_active === false) {
    const next = rows.filter((existing) => !sameCell(existing, jobId, technicianId, date));
    return next.length === rows.length ? rows : next;
  }

  const index = rows.findIndex((existing) => sameCell(existing, jobId, technicianId, date));
  if (index >= 0) {
    const current = rows[index];
    const updated: MatrixTimesheetAssignment = {
      ...current,
      is_schedule_only: boolOrNull(row.is_schedule_only) ?? current.is_schedule_only ?? null,
      source: strOrNull(row.source) ?? current.source ?? null,
    };
    const next = rows.slice();
    next[index] = updated;
    return next;
  }

  // A new day: only inside what this query covers, and only for a job it knows.
  if (!scope.technicianIds.has(technicianId) || date < scope.startKey || date > scope.endKey) return rows;
  const job = rows.find((existing) => existing.job_id === jobId)?.job ?? scope.jobsById.get(jobId);
  if (!job) return rows;
  // Role and status come from the technician's other days on the job, when the
  // matrix has them; otherwise the refetch fills them in.
  const sibling = rows.find((existing) => existing.job_id === jobId && existing.technician_id === technicianId);
  const added: MatrixTimesheetAssignment = {
    job_id: jobId,
    technician_id: technicianId,
    date,
    job,
    status: sibling?.status ?? null,
    assigned_at: sibling?.assigned_at ?? null,
    assigned_by: sibling?.assigned_by ?? null,
    single_day: sibling?.single_day ?? null,
    assignment_date: sibling?.assignment_date ?? null,
    sound_role: sibling?.sound_role ?? null,
    lights_role: sibling?.lights_role ?? null,
    video_role: sibling?.video_role ?? null,
    is_schedule_only: boolOrNull(row.is_schedule_only),
    source: strOrNull(row.source),
  };
  return [...rows, added];
}

/** job_assignments: status and roles for every day a technician has on a job. */
export function applyJobAssignmentChange(
  rows: MatrixTimesheetAssignment[],
  change: RealtimeChange,
): MatrixTimesheetAssignment[] | null {
  if (change.eventType === "DELETE") {
    const old = change.old ?? {};
    const jobId = str(old.job_id);
    const technicianId = str(old.technician_id);
    if (!jobId || !technicianId) return null;
    const next = rows.filter((row) => !(row.job_id === jobId && row.technician_id === technicianId));
    return next.length === rows.length ? rows : next;
  }

  const row = change.new ?? {};
  const jobId = str(row.job_id);
  const technicianId = str(row.technician_id);
  if (!jobId || !technicianId) return null;

  let changed = false;
  const next = rows.map((existing) => {
    if (existing.job_id !== jobId || existing.technician_id !== technicianId) return existing;
    changed = true;
    return {
      ...existing,
      status: strOrNull(row.status) ?? existing.status,
      sound_role: "sound_role" in row ? strOrNull(row.sound_role) : existing.sound_role,
      lights_role: "lights_role" in row ? strOrNull(row.lights_role) : existing.lights_role,
      video_role: "video_role" in row ? strOrNull(row.video_role) : existing.video_role,
      assigned_at: "assigned_at" in row ? strOrNull(row.assigned_at) : existing.assigned_at,
      assigned_by: "assigned_by" in row ? strOrNull(row.assigned_by) : existing.assigned_by,
      single_day: "single_day" in row ? boolOrNull(row.single_day) : existing.single_day,
      assignment_date: "assignment_date" in row ? strOrNull(row.assignment_date) : existing.assignment_date,
    };
  });
  return changed ? next : rows;
}
