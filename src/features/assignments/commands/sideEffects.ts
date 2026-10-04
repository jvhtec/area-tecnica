import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { getAssignmentNotificationDepartments } from '@/utils/assignmentNotificationDepartments';
import { getErrorMessage } from '@/utils/errorMessage';
import {
  sideEffectSchema,
  supersedeResultSchema,
  type AssignmentCommandResult,
  type AssignmentCommandRow,
  type AssignmentSideEffect,
  type SupersedeResult,
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

const claimSchema = z.object({
  claim_token: z.string().nullable(),
  effects: z.array(sideEffectSchema.extend({ index: z.number().int().nonnegative() })),
});

/** How long one runner may hold an effect before it becomes retryable. */
const CLAIM_LEASE_SECONDS = 120;

const invoke = async (name: string, body: Record<string, unknown>) => {
  const { error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
};

const notificationBody = (
  effect: AssignmentSideEffect,
  result: Pick<AssignmentCommandResult, 'technician_id' | 'assignment' | 'dates' | 'removed'>,
  context: SideEffectContext,
): Record<string, unknown> => ({
  ...notificationPayload(effect, result, context),
  // Stable per effect: push delivers each notification at most once per
  // recipient, however often the effect is retried or reported.
  idempotency_key: effect.effect_id,
});

const notificationPayload = (
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
 * notifications) and reports each outcome to the ledger. Effects are claimed
 * first, so a concurrent runner (another tab, a retry from the reconciliation
 * panel) never executes the same effect twice; only claimed effects run.
 * Failures never undo the committed assignment; they stay visible in the
 * reconciliation backlog (get_assignment_side_effect_backlog) for retry.
 */
export async function runAssignmentSideEffects(
  commandId: string,
  result: Pick<AssignmentCommandResult, 'technician_id' | 'assignment' | 'dates' | 'removed' | 'side_effects'>,
  context: SideEffectContext = {},
): Promise<SideEffectSummary> {
  if (result.side_effects.length === 0) return { attempted: 0, failed: 0, recorded: true };

  const { data: claimData, error: claimError } = await supabase.rpc('claim_assignment_side_effects', {
    p_command_id: commandId,
    p_lease_seconds: CLAIM_LEASE_SECONDS,
  });
  const claim = claimError ? null : claimSchema.safeParse(claimData);
  if (!claim?.success || !claim.data.claim_token) {
    if (claimError || (claim && !claim.success)) {
      console.warn('Could not claim assignment side effects; they stay pending for retry', { commandId, claimError });
    }
    return { attempted: 0, failed: 0, recorded: !claimError };
  }
  const claimToken = claim.data.claim_token;

  const reports: EffectReport[] = await Promise.all(claim.data.effects.map(async ({ index, ...effect }): Promise<EffectReport> => {
    try {
      await runEffect({ ...effect, effect_id: effect.effect_id ?? `${commandId}:${index}` }, result, context);
      return { index, status: 'succeeded' };
    } catch (error) {
      return { index, status: 'failed', error: getErrorMessage(error, 'Error desconocido').slice(0, 500) };
    }
  }));

  const failed = reports.filter((report) => report.status === 'failed').length;
  const { error } = await supabase.rpc('record_assignment_side_effects', {
    p_command_id: commandId,
    p_claim_token: claimToken,
    p_results: reports,
  });
  if (error) console.warn('Could not record assignment side-effect outcomes', { commandId, error });
  return { attempted: reports.length, failed, recorded: !error };
}

/**
 * Cancels the post-commit effects of commands the manager just undid, as long
 * as they have not run. `not_superseded > 0` means something already ran (or is
 * running), so the caller must let the inverse command's own effects run too:
 * the technician or Flex already heard about the original change.
 */
export async function supersedeAssignmentSideEffects(commandIds: string[]): Promise<SupersedeResult> {
  const { data, error } = await supabase.rpc('supersede_assignment_side_effects', { p_command_ids: commandIds });
  if (error) throw error;
  const parsed = supersedeResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Respuesta de cancelación de efectos no reconocida');
  return parsed.data;
}
