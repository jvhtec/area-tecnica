import { supabase } from '@/lib/supabase';
import {
  AssignmentCommandError,
  classifyAssignmentRpcError,
  isRejectionCode,
} from '@/features/assignments/commands/errors';
import {
  commandResultSchema,
  commandStateSchema,
  jobCommandStatesSchema,
  type ApplyDirectAssignmentInput,
  type AssignmentCommandResult,
  type AssignmentCommandState,
  type ChangeAssignmentRoleInput,
  type JobAssignmentCommandStates,
  type SetAssignmentStatusInput,
  type RemoveAssignmentDateInput,
  type RemoveDirectAssignmentInput,
} from '@/features/assignments/commands/types';

/** One id per logical decision; reuse it for transport retries of that decision. */
export const createAssignmentCommandId = (): string => crypto.randomUUID();

const RETRY_DELAYS_MS = [400, 1200];

/** Wait between transport retries without changing the logical command identity. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RpcResponse = { data: unknown; error: unknown };

/**
 * Executes one command RPC. Network failures are retried with the same
 * command id — safe because the database replays an already committed command
 * instead of applying it twice. Rejections are returned as results with
 * `ok: false`; callers decide how to present them.
 */
async function execute(call: () => PromiseLike<RpcResponse>): Promise<AssignmentCommandResult> {
  let lastError: AssignmentCommandError | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    let response: RpcResponse;
    try {
      response = await call();
    } catch (thrown) {
      lastError = classifyAssignmentRpcError(thrown);
      if (lastError.retryable) continue;
      throw lastError;
    }
    if (response.error) {
      lastError = classifyAssignmentRpcError(response.error);
      if (lastError.retryable) continue;
      throw lastError;
    }
    const parsed = commandResultSchema.safeParse(response.data);
    if (!parsed.success) {
      throw new AssignmentCommandError('unknown', { message: 'Respuesta de asignación no reconocida', cause: parsed.error });
    }
    return parsed.data;
  }
  throw lastError ?? new AssignmentCommandError('network');
}

/** Throws an AssignmentCommandError for a rejected result; returns committed/noop results. */
export function requireCommitted(result: AssignmentCommandResult): AssignmentCommandResult {
  if (result.ok) return result;
  const code = isRejectionCode(result.code) ? result.code : 'unknown';
  throw new AssignmentCommandError(code, { result });
}

/** Apply or move membership and schedule in one state-checked database command. */
export function applyDirectAssignment(input: ApplyDirectAssignmentInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('apply_direct_assignment', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_role: input.role,
    p_status: input.status,
    p_coverage: input.coverage,
    p_dates: input.coverage === 'full' ? undefined : input.dates,
    p_mode: input.mode ?? 'replace',
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_from_job_id: input.fromJobId ?? undefined,
    p_expected_from_state_token: input.expectedFromStateToken ?? undefined,
    p_conflict_policy: input.conflictPolicy ?? 'reject',
    p_source: input.source ?? 'assignment-dialog',
  }));
}

/** Remove the complete assignment through the approved-timesheet protection boundary. */
export function removeDirectAssignment(input: RemoveDirectAssignmentInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('remove_direct_assignment', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_source: input.source ?? 'matrix',
  }));
}

/** Remove one scheduled day without widening removal to other dates. */
export function removeAssignmentDate(input: RemoveAssignmentDateInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('remove_assignment_date', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_date: input.date,
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_source: input.source ?? 'matrix',
  }));
}

/** Change one department role with state checking and server-side category synchronization. */
export function changeAssignmentRole(input: ChangeAssignmentRoleInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('change_assignment_role', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_department: input.department,
    p_role: input.role && input.role !== 'none' ? input.role : undefined,
    p_sync_category: input.syncCategory ?? true,
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_source: input.source ?? 'job-card',
  }));
}

/** Confirm or decline membership through the shared assignment lifecycle command. */
export function setAssignmentStatus(input: SetAssignmentStatusInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('set_assignment_status', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_action: input.action,
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_source: input.source ?? 'matrix',
    p_metadata: input.notes ? { notes: input.notes } : undefined,
  }));
}

/** Authoritative membership + active dates + expected-state token for a pair. */
export async function getAssignmentCommandState(jobId: string, technicianId: string): Promise<AssignmentCommandState> {
  const { data, error } = await supabase.rpc('get_assignment_command_state', {
    p_job_id: jobId,
    p_technician_id: technicianId,
  });
  if (error) throw classifyAssignmentRpcError(error);
  const parsed = commandStateSchema.safeParse(data);
  if (!parsed.success) {
    throw new AssignmentCommandError('unknown', { message: 'Estado de asignación no reconocido', cause: parsed.error });
  }
  return parsed.data;
}

/**
 * State tokens for every technician on a job. Job-level surfaces load this
 * with their list and send the technician's token back with each command, so
 * a change made elsewhere meanwhile is rejected as stale.
 */
export async function getJobAssignmentCommandStates(jobId: string): Promise<JobAssignmentCommandStates> {
  const { data, error } = await supabase.rpc('get_job_assignment_command_states', { p_job_id: jobId });
  if (error) throw classifyAssignmentRpcError(error);
  const parsed = jobCommandStatesSchema.safeParse(data);
  if (!parsed.success) {
    throw new AssignmentCommandError('unknown', { message: 'Estado de asignaciones no reconocido', cause: parsed.error });
  }
  const { job_id: parsedJobId, absent_state_token: absentStateToken, states } = parsed.data;
  return {
    jobId: parsedJobId,
    absentStateToken,
    tokenFor: (technicianId) => states[technicianId] ?? absentStateToken,
  };
}
