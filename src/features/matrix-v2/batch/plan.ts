import { planFocusAssign } from '@/features/matrix-v2/focus/focusAssign';
import { buildStaffingPayload, type StaffingChannel, type StaffingPhase } from '@/features/matrix-v2/staffing/payload';
import { slotsForDepartment as departmentSlots } from '@/features/matrix-v2/roleSlots';
import { suggestRole } from '@/features/matrix-v2/roleSuggestion';
import { roleDisciplineForDepartment } from '@/features/matrix-v2/types';
import { dayRangeLabel, jobDayKeys } from '@/features/matrix-v2/jobDays';
import { technicianDisplayName } from '@/features/matrix-v2/names';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { MatrixIntent, MatrixTechnicianRef } from '@/features/matrix-v2/types';
import type { BatchRow } from '@/features/matrix-v2/batch/types';
import { daysByTechnician, parseCellKey } from '@/features/matrix-v2/batch/selection';
import type { MatrixJob } from '@/hooks/useOptimizedMatrixData';

export interface BatchAssignmentRef {
  job_id: string;
  status?: string | null;
  job?: { title?: string | null } | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}

/** What the grid already knows; the planners read nothing else. */
export interface BatchLookups {
  technician: (technicianId: string) => (MatrixTechnicianRef & { id: string }) | undefined;
  job: (jobId: string) => MatrixJob | undefined;
  assignmentOn: (technicianId: string, dateKey: string) => BatchAssignmentRef | undefined;
  isUnavailable: (technicianId: string, dateKey: string) => boolean;
  isFridge: (technicianId: string) => boolean;
  declinedJobIds: (technicianId: string) => Set<string> | undefined;
  roleSlots: (jobId: string) => RoleSlot[] | undefined;
  lastRole: (technicianId: string) => string | null;
}

const pairId = (technicianId: string, jobId: string) => `${technicianId}:${jobId}`;

const baseRow = (technicianId: string, jobId: string, name: string, summary: string, openDay?: string): BatchRow => ({
  id: pairId(technicianId, jobId),
  technicianId,
  name,
  summary,
  openAt: openDay ? { technicianId, dateKey: openDay } : undefined,
  intents: [],
  next: 0,
  status: 'pending',
  changed: false,
  reversible: true,
  undos: [],
});

const skipped = (row: BatchRow, message: string): BatchRow => ({ ...row, status: 'skipped', message });

const roleHeld = (assignment: BatchAssignmentRef | undefined): string | null =>
  assignment?.sound_role || assignment?.lights_role || assignment?.video_role || null;

/** The selected cells that hold an assignment, grouped by technician and job. */
export function groupAssignedPairs(keys: Iterable<string>, lookups: BatchLookups) {
  const pairs = new Map<string, { technicianId: string; jobId: string; title: string; status: string; days: string[] }>();
  let empty = 0;
  for (const key of keys) {
    const { technicianId, dateKey } = parseCellKey(key);
    const assignment = lookups.assignmentOn(technicianId, dateKey);
    if (!assignment) {
      empty += 1;
      continue;
    }
    const id = pairId(technicianId, assignment.job_id);
    const pair = pairs.get(id) ?? { technicianId, jobId: assignment.job_id, title: assignment.job?.title ?? lookups.job(assignment.job_id)?.title ?? 'Trabajo', status: (assignment.status ?? '').toLowerCase(), days: [] };
    pair.days.push(dateKey);
    pairs.set(id, pair);
  }
  pairs.forEach((pair) => { pair.days = [...new Set(pair.days)].sort(); });
  return { pairs: [...pairs.values()], empty };
}

/** Invitations among the selected cells become confirmations, one row per pair. */
export function planConfirmRows(keys: Iterable<string>, lookups: BatchLookups) {
  const { pairs, empty } = groupAssignedPairs(keys, lookups);
  const rows: BatchRow[] = [];
  let alreadyConfirmed = 0;
  let notInvited = 0;
  for (const pair of pairs) {
    if (pair.status === 'confirmed') {
      alreadyConfirmed += 1;
      continue;
    }
    if (pair.status !== 'invited') {
      notInvited += 1;
      continue;
    }
    const intent: MatrixIntent = { kind: 'confirm', technicianId: pair.technicianId, jobId: pair.jobId, source: 'matrix-batch' };
    rows.push({
      ...baseRow(pair.technicianId, pair.jobId, technicianDisplayName(lookups.technician(pair.technicianId)), `${pair.title} · ${dayRangeLabel(pair.days)}`, pair.days[0]),
      intents: [intent],
    });
  }
  return { rows, alreadyConfirmed, notInvited, empty };
}

/**
 * Assigns the selected people to one job, on the selected days that belong to
 * it. Each person's role is picked as in job focus, taking slots in turn so a
 * batch spreads over the job's open slots. Days they cannot work are left out
 * and said so; busy days are left to the server, which refuses with the clash.
 */
export function planAssignRows(
  keys: Iterable<string>,
  jobId: string,
  status: 'invited' | 'confirmed',
  lookups: BatchLookups,
): BatchRow[] {
  const job = lookups.job(jobId);
  if (!job) return [];
  const jobDays = jobDayKeys(job);
  const jobDaySet = new Set(jobDays);
  const slots: RoleSlot[] = (lookups.roleSlots(jobId) ?? []).map((slot) => ({ ...slot }));
  const rows: BatchRow[] = [];

  daysByTechnician(keys).forEach((selected, technicianId) => {
    const technician = lookups.technician(technicianId);
    const name = technicianDisplayName(technician);
    const inJob = selected.filter((day) => jobDaySet.has(day));
    const row = baseRow(technicianId, jobId, name, `${job.title} · ${dayRangeLabel(inJob.length ? inJob : selected)}`, (inJob[0] ?? selected[0]));
    if (!technician) return void rows.push(skipped(row, 'No se encontró a esta persona'));
    if (inJob.length === 0) return void rows.push(skipped(row, 'Ninguno de los días elegidos es de este trabajo'));
    if (lookups.isFridge(technicianId)) return void rows.push(skipped(row, 'Está en la nevera'));
    if (lookups.declinedJobIds(technicianId)?.has(jobId)) return void rows.push(skipped(row, 'Rechazó este trabajo'));

    const onJob = inJob.filter((day) => lookups.assignmentOn(technicianId, day)?.job_id === jobId);
    const unavailable = inJob.filter((day) => !onJob.includes(day) && lookups.isUnavailable(technicianId, day));
    const days = inJob.filter((day) => !onJob.includes(day) && !unavailable.includes(day));
    if (days.length === 0) {
      if (onJob.length > 0) return void rows.push({ ...row, status: 'noop', message: 'Ya estaba en el trabajo esos días' });
      return void rows.push(skipped(row, 'No está disponible esos días'));
    }

    const existingRole = onJob.length > 0 ? roleHeld(lookups.assignmentOn(technicianId, onJob[0])) : null;
    const plan = planFocusAssign({
      technician, jobId, days, jobDays, status, slots,
      lastRoleCode: lookups.lastRole(technicianId), existingRole, source: 'matrix-batch',
    });
    const withNote = (message?: string) => (unavailable.length > 0
      ? [message, `${unavailable.length === 1 ? '1 día no disponible omitido' : `${unavailable.length} días no disponibles omitidos`}`].filter(Boolean).join(' · ')
      : message);
    if (plan.kind === 'inspect') {
      rows.push({ ...row, status: 'needs-role', message: 'Elige el rol: puede encajar en varios niveles', openAt: { technicianId, dateKey: days[0] } });
      return;
    }
    if (!existingRole) {
      const taken = slots.find((slot) => slot.code === plan.intent.role);
      if (taken) {
        taken.open = Math.max(taken.open - 1, 0);
        taken.filled += 1;
      }
    }
    rows.push({ ...row, summary: `${job.title} · ${dayRangeLabel(days)}`, intents: [plan.intent], message: withNote(undefined) });
  });
  return rows;
}

/**
 * The commands that remove the selected days of one pair, given the days the
 * pair really has. Taking every day is a removal of the assignment (the
 * database refuses to remove a last day); otherwise one command per day.
 */
export function resolveRemoveIntents(
  pair: { technicianId: string; jobId: string; selectedDays: string[] },
  state: { exists: boolean; dates: string[] },
): MatrixIntent[] {
  if (!state.exists) return [];
  const selected = new Set(pair.selectedDays);
  const present = state.dates.filter((day) => selected.has(day));
  if (present.length === 0 && state.dates.length > 0) return [];
  const remaining = state.dates.filter((day) => !selected.has(day));
  if (remaining.length === 0) return [{ kind: 'remove', technicianId: pair.technicianId, jobId: pair.jobId, source: 'matrix-batch' }];
  return present.map((date) => ({ kind: 'remove-date', technicianId: pair.technicianId, jobId: pair.jobId, date, source: 'matrix-batch' }));
}

/** One row per pair for a removal, once each pair's real days are known. */
export function buildRemoveRows(
  pairs: Array<{ technicianId: string; jobId: string; title: string; days: string[] }>,
  states: Map<string, { exists: boolean; dates: string[] }>,
  lookups: BatchLookups,
): BatchRow[] {
  return pairs.map((pair) => {
    const row = baseRow(pair.technicianId, pair.jobId, technicianDisplayName(lookups.technician(pair.technicianId)), `${pair.title} · ${dayRangeLabel(pair.days)}`, pair.days[0]);
    const state = states.get(pairId(pair.technicianId, pair.jobId));
    if (!state) return skipped(row, 'No se pudo leer su estado: inténtalo de nuevo');
    const intents = resolveRemoveIntents({ technicianId: pair.technicianId, jobId: pair.jobId, selectedDays: pair.days }, state);
    if (intents.length === 0) return { ...row, status: 'noop' as const, message: 'Ya no tenía asignación esos días' };
    return { ...row, intents };
  });
}

/**
 * Availability requests or offers for the selected people, on the selected days
 * that belong to the job: one request per person. An offer needs a role, picked
 * from the job's open slots in turn; when that cannot be decided the row asks.
 */
export function planStaffingRows(
  keys: Iterable<string>,
  jobId: string,
  phase: StaffingPhase,
  channel: StaffingChannel,
  department: string | null,
  lookups: BatchLookups,
): BatchRow[] {
  const job = lookups.job(jobId);
  if (!job) return [];
  const jobDays = jobDayKeys(job);
  const jobDaySet = new Set(jobDays);
  const slots: RoleSlot[] = (lookups.roleSlots(jobId) ?? []).map((slot) => ({ ...slot }));
  const description = (job.description ?? '').trim();
  const rows: BatchRow[] = [];

  daysByTechnician(keys).forEach((selected, technicianId) => {
    const technician = lookups.technician(technicianId);
    const inJob = selected.filter((day) => jobDaySet.has(day));
    const row = baseRow(technicianId, jobId, technicianDisplayName(technician), `${job.title} · ${dayRangeLabel(inJob.length ? inJob : selected)}`, inJob[0] ?? selected[0]);
    if (!technician) return void rows.push(skipped(row, 'No se encontró a esta persona'));
    if (inJob.length === 0) return void rows.push(skipped(row, 'Ninguno de los días elegidos es de este trabajo'));
    if (lookups.isFridge(technicianId)) return void rows.push(skipped(row, 'Está en la nevera'));
    if (lookups.declinedJobIds(technicianId)?.has(jobId)) return void rows.push(skipped(row, 'Rechazó este trabajo'));
    const days = inJob.filter((day) => !lookups.isUnavailable(technicianId, day));
    if (days.length === 0) return void rows.push(skipped(row, 'No está disponible esos días'));
    const note = days.length < inJob.length ? `${inJob.length - days.length === 1 ? '1 día no disponible omitido' : `${inJob.length - days.length} días no disponibles omitidos`}` : undefined;

    let role: string | null = null;
    if (phase === 'offer') {
      const discipline = roleDisciplineForDepartment(technician.department);
      role = suggestRole({ technician, slots: departmentSlots(slots, discipline), lastRoleCode: lookups.lastRole(technicianId) }).code;
      if (!role) return void rows.push({ ...row, status: 'needs-role', message: 'Elige el rol: puede encajar en varios niveles', openAt: { technicianId, dateKey: days[0] } });
      const taken = slots.find((slot) => slot.code === role);
      if (taken) {
        taken.open = Math.max(taken.open - 1, 0);
        taken.filled += 1;
      }
    }
    rows.push({
      ...row,
      summary: `${job.title} · ${dayRangeLabel(days)}`,
      message: note,
      staffing: { payload: buildStaffingPayload({ jobId, technicianId, phase, channel, department, days, jobDays, role, message: description }) },
    });
  });
  return rows;
}

export const pairKey = pairId;
