import { toast } from 'sonner';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { coverageForDays, dayRangeLabel } from '@/features/matrix-v2/jobDays';
import { reportDone } from '@/features/matrix-v2/outcomeToast';
import { slotsForDepartment, type RoleSlot } from '@/features/matrix-v2/roleSlots';
import { suggestRole } from '@/features/matrix-v2/roleSuggestion';
import {
  roleDisciplineForDepartment,
  type MatrixCommandSource,
  type MatrixIntent,
  type MatrixTechnicianRef,
} from '@/features/matrix-v2/types';

type AssignIntent = Extract<MatrixIntent, { kind: 'assign' }>;

export type FocusAssignPlan =
  | { kind: 'run'; intent: AssignIntent; days: string[] }
  /** The role cannot be picked without asking: the inspector asks. */
  | { kind: 'inspect'; reason: string };

export interface FocusAssignInput {
  technician: MatrixTechnicianRef;
  jobId: string;
  /** Days to add: the clicked day, or every day that is free. */
  days: string[];
  /** Every day of the job, so "all of them" becomes full coverage. */
  jobDays: string[];
  status: 'invited' | 'confirmed';
  slots: RoleSlot[] | undefined;
  lastRoleCode?: string | null;
  /** The role the technician already holds on this job, when they are on it. */
  existingRole?: string | null;
  /** Where the command came from; job focus by default. */
  source?: MatrixCommandSource;
}

/**
 * What a click in job focus does: add the days with the next open slot of the
 * technician's discipline, keeping the role they already hold on the job. When
 * several levels fit and nothing says which, it never guesses a pay level.
 */
export function planFocusAssign(input: FocusAssignInput): FocusAssignPlan {
  const { technician, jobId, days, jobDays, status, slots, lastRoleCode, existingRole, source = 'matrix-focus' } = input;
  if (days.length === 0) return { kind: 'inspect', reason: 'no-days' };
  const discipline = roleDisciplineForDepartment(technician.department);
  const role = existingRole ?? suggestRole({
    technician,
    slots: slotsForDepartment(slots, discipline),
    lastRoleCode: lastRoleCode ?? null,
  }).code;
  if (!role) return { kind: 'inspect', reason: 'role' };
  const { coverage, dates } = coverageForDays(days, jobDays);
  return {
    kind: 'run',
    days: [...days].sort(),
    intent: {
      kind: 'assign',
      technicianId: technician.id,
      jobId,
      role,
      status,
      coverage,
      dates,
      // Adding days never drops the ones the technician already has.
      mode: 'add',
      source,
    },
  };
}

/** Runs a planned assignment and tells the manager how it went, with Deshacer or the way to fix a rejection. */
export async function runFocusAssign(
  runner: MatrixCommandRunner,
  plan: Extract<FocusAssignPlan, { kind: 'run' }>,
  { name, jobTitle, openInspector }: { name: string; jobTitle: string; openInspector: () => void },
): Promise<void> {
  const outcome = await runner.run(plan.intent);
  if (!outcome.ok) {
    toast.error(outcome.message, { action: { label: 'Abrir celda', onClick: openInspector } });
    return;
  }
  const verb = plan.intent.status === 'confirmed' ? 'confirmado' : 'invitado';
  reportDone(`${name} ${verb}`, outcome, `${jobTitle} · ${dayRangeLabel(plan.days)}`);
}
