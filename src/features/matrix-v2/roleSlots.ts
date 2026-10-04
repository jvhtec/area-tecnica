import { roleOptionsForDiscipline } from '@/types/roles';
import { roleDepartmentForCode } from '@/features/matrix-v2/types';

/** Rows of `job_required_roles_summary`: what each job asks for, per department. */
export interface RoleSlotSummaryRow {
  job_id: string;
  department: string;
  roles: Array<{ role_code: string; quantity: number }>;
}

/** The part of a `job_assignments` row that fills a slot. */
export interface RoleSlotAssignmentRow {
  job_id: string;
  technician_id?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  production_role?: string | null;
  status?: string | null;
}

export interface RoleSlot {
  code: string;
  department: string;
  required: number;
  /** Everyone not declined who holds the role, invited ones included. */
  filled: number;
  /** Of `filled`, those who have not confirmed yet. */
  invited: number;
  open: number;
}

const ROLE_COLUMNS = [
  ['sound', 'sound_role'],
  ['lights', 'lights_role'],
  ['video', 'video_role'],
  ['production', 'production_role'],
] as const;

const DEPARTMENT_ORDER = ['sound', 'lights', 'video', 'production'];

const roleIndex = new Map<string, number>(
  DEPARTMENT_ORDER.flatMap((department) =>
    roleOptionsForDiscipline(department).map((option, index) => [option.code, index] as const)),
);

const hasRole = (role: string | null | undefined): role is string =>
  typeof role === 'string' && role.trim() !== '' && role.trim().toLowerCase() !== 'none';

/**
 * Role slots per job: required quantity against who already holds the role.
 * Counting matches the "outstanding staffing" reminder: a declined technician
 * does not fill a slot, an invited one does.
 */
export function buildJobRoleSlots(
  summaries: RoleSlotSummaryRow[],
  assignments: RoleSlotAssignmentRow[],
): Map<string, RoleSlot[]> {
  const filled = new Map<string, { filled: number; invited: number }>();
  for (const row of assignments) {
    if (!row.job_id) continue;
    const status = (row.status ?? '').toLowerCase();
    if (status === 'declined') continue;
    for (const [department, column] of ROLE_COLUMNS) {
      const role = row[column];
      if (!hasRole(role)) continue;
      const key = `${row.job_id}:${department}:${role.trim()}`;
      const entry = filled.get(key) ?? { filled: 0, invited: 0 };
      entry.filled += 1;
      if (status !== 'confirmed') entry.invited += 1;
      filled.set(key, entry);
    }
  }

  const slotsByJob = new Map<string, RoleSlot[]>();
  for (const summary of summaries) {
    if (!summary.job_id || !summary.department) continue;
    const slots = slotsByJob.get(summary.job_id) ?? [];
    for (const role of summary.roles) {
      const required = Number(role.quantity) || 0;
      if (!role.role_code || required <= 0) continue;
      const entry = filled.get(`${summary.job_id}:${summary.department}:${role.role_code}`) ?? { filled: 0, invited: 0 };
      slots.push({
        code: role.role_code,
        department: summary.department,
        required,
        filled: entry.filled,
        invited: entry.invited,
        open: Math.max(required - entry.filled, 0),
      });
    }
    slotsByJob.set(summary.job_id, slots);
  }

  for (const [jobId, slots] of slotsByJob) {
    slotsByJob.set(jobId, slots.sort((a, b) =>
      DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department)
      || (roleIndex.get(a.code) ?? 999) - (roleIndex.get(b.code) ?? 999)
      || a.code.localeCompare(b.code)));
  }
  return slotsByJob;
}

/** Slots a technician of the given discipline could take on a job. */
export const slotsForDepartment = (slots: RoleSlot[] | undefined, department: string | null): RoleSlot[] =>
  (slots ?? []).filter((slot) => !department || slot.department === department || roleDepartmentForCode(slot.code) === department);

/** Next slot to fill: the first one with room. */
export const nextOpenSlot = (slots: RoleSlot[] | undefined): RoleSlot | null =>
  (slots ?? []).find((slot) => slot.open > 0) ?? null;
