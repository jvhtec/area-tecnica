import { supabase } from '@/lib/supabase';
import { getAssignmentNotificationDepartments } from '@/utils/assignmentNotificationDepartments';
import { getErrorMessage } from '@/utils/errorMessage';
import type {
  AssignmentCommandResult,
  AssignmentCommandRow,
  AssignmentSideEffect,
} from '@/features/assignments/commands/types';

export interface SideEffectContext {
  /** Technician department, used when roles do not name a department. */
  technicianDepartment?: string | null;
  recipientName?: string | null;
}

export interface SideEffectSummary {
  attempted: number;
  failed: number;
  /** False when outcomes could not be written back to the ledger. */
  recorded: boolean;
}

type EffectReport = { index: number; status: 'succeeded' | 'failed'; error?: string };

const invoke = async (name: string, body: Record<string, unknown>) => {
  const { error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
};

const notificationBody = (
  effect: AssignmentSideEffect,
  result: Pick<AssignmentCommandResult, 'technician_id' | 'assignment' | 'dates' | 'removed'>,
  context: SideEffectContext,
): Record<string, unknown> => {
  if (effect.action === 'assignment.removed') {
    const removed: AssignmentCommandRow | null = result.removed?.assignment ?? null;
    const departments = getAssignmentNotificationDepartments(removed, context.technicianDepartment);
    return {
      action: 'broadcast',
      type: 'assignment.removed',
      job_id: effect.job_id,
      recipient_id: result.technician_id,
      technician_id: result.technician_id,
      department: departments[0],
      departments,
    };
  }
  if (effect.action === 'job.assignment.confirmed') {
    return {
      action: 'broadcast',
      type: 'job.assignment.confirmed',
      job_id: effect.job_id,
      recipient_id: result.technician_id,
      recipient_name: context.recipientName?.trim() || undefined,
    };
  }
  const assignment = result.assignment;
  const departments = getAssignmentNotificationDepartments(assignment, context.technicianDepartment);
  const scoped = assignment?.single_day ?? false;
  return {
    action: 'broadcast',
    type: 'job.assignment.direct',
    job_id: effect.job_id,
    recipient_id: result.technician_id,
    recipient_name: context.recipientName?.trim() || undefined,
    assignment_status: assignment?.status === 'confirmed' ? 'confirmed' : 'invited',
    target_date: scoped && result.dates.length === 1 ? `${result.dates[0]}T00:00:00Z` : undefined,
    single_day: scoped,
    department: departments[0],
    departments,
  };
};

async function runEffect(
  effect: AssignmentSideEffect,
  result: Pick<AssignmentCommandResult, 'technician_id' | 'assignment' | 'dates' | 'removed'>,
  context: SideEffectContext,
) {
  if (effect.kind === 'flex') {
    if (!effect.department) throw new Error('Flex effect without department');
    await invoke('manage-flex-crew-assignments', {
      job_id: effect.job_id,
      technician_id: result.technician_id,
      department: effect.department,
      action: effect.action,
    });
    return;
  }
  await invoke('push', notificationBody(effect, result, context));
}

/**
 * Executes the post-commit plan a command returned (Flex crew sync and
 * notifications) and reports each outcome to the ledger. Failures never undo
 * the committed assignment; they stay visible in the reconciliation backlog
 * (get_assignment_side_effect_backlog) and can be retried there.
 */
export async function runAssignmentSideEffects(
  commandId: string,
  result: Pick<AssignmentCommandResult, 'technician_id' | 'assignment' | 'dates' | 'removed' | 'side_effects'>,
  context: SideEffectContext = {},
  options: { onlyIndexes?: number[] } = {},
): Promise<SideEffectSummary> {
  const reports: EffectReport[] = [];
  await Promise.all(result.side_effects.map(async (effect, index) => {
    if (options.onlyIndexes && !options.onlyIndexes.includes(index)) return;
    if (effect.status === 'succeeded') return;
    try {
      await runEffect(effect, result, context);
      reports.push({ index, status: 'succeeded' });
    } catch (error) {
      reports.push({ index, status: 'failed', error: getErrorMessage(error, 'Error desconocido').slice(0, 500) });
    }
  }));

  if (reports.length === 0) return { attempted: 0, failed: 0, recorded: true };
  reports.sort((a, b) => a.index - b.index);
  const failed = reports.filter((report) => report.status === 'failed').length;
  const { error } = await supabase.rpc('record_assignment_side_effects', {
    p_command_id: commandId,
    p_results: reports,
  });
  if (error) console.warn('Could not record assignment side-effect outcomes', { commandId, error });
  return { attempted: reports.length, failed, recorded: !error };
}
