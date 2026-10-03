import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { classifyAssignmentRpcError } from '@/features/assignments/commands/errors';
import { runAssignmentSideEffects, type SideEffectSummary } from '@/features/assignments/commands/sideEffects';
import { commandResultSchema, sideEffectSchema } from '@/features/assignments/commands/types';

const backlogRowSchema = z.object({
  command_id: z.string(),
  command_type: z.string(),
  job_id: z.string(),
  technician_id: z.string(),
  source: z.string(),
  side_effects: z.array(sideEffectSchema),
  side_effects_status: z.enum(['pending', 'failed', 'succeeded', 'none']),
  created_at: z.string(),
});
export type AssignmentSideEffectBacklogRow = z.infer<typeof backlogRowSchema>;

const consistencyIssueSchema = z.object({
  issue: z.enum([
    'membership_without_schedule',
    'schedule_without_membership',
    'scoped_date_not_scheduled',
    'declined_with_active_schedule',
  ]),
  job_id: z.string(),
  technician_id: z.string(),
  details: z.record(z.unknown()).nullable(),
});
export type AssignmentConsistencyIssue = z.infer<typeof consistencyIssueSchema>;

/** Commands whose Flex/notification effects failed or never reported back. */
export async function fetchAssignmentSideEffectBacklog(limit = 50): Promise<AssignmentSideEffectBacklogRow[]> {
  const { data, error } = await supabase.rpc('get_assignment_side_effect_backlog', { p_limit: limit });
  if (error) throw classifyAssignmentRpcError(error);
  return z.array(backlogRowSchema).parse(data ?? []);
}

/** Read-only membership/schedule diagnostics. There is deliberately no repair action. */
export async function fetchAssignmentConsistencyIssues(limit = 200): Promise<AssignmentConsistencyIssue[]> {
  const { data, error } = await supabase.rpc('get_assignment_consistency_issues', { p_limit: limit });
  if (error) throw classifyAssignmentRpcError(error);
  return z.array(consistencyIssueSchema).parse(data ?? []);
}

/**
 * Re-runs the unfinished effects of one ledger command from its stored
 * result. Flex add/remove are idempotent; a notification retry may notify
 * again, which is the documented best-effort semantics.
 */
export async function retryAssignmentSideEffects(commandId: string): Promise<SideEffectSummary> {
  const { data, error } = await supabase
    .from('assignment_commands')
    .select('result, side_effects')
    .eq('command_id', commandId)
    .single();
  if (error) throw classifyAssignmentRpcError(error);
  const result = commandResultSchema.parse(data.result);
  const effects = z.array(sideEffectSchema).parse(data.side_effects);
  return runAssignmentSideEffects(commandId, { ...result, side_effects: effects });
}
