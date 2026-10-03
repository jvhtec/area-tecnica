import { supabase } from '@/lib/supabase';
import {
  AssignmentCommandError,
  classifyAssignmentRpcError,
  isRejectionCode,
} from '@/features/assignments/commands/errors';
import {
  commandResultSchema,
  commandStateSchema,
  type ApplyDirectAssignmentInput,
  type AssignmentCommandResult,
  type AssignmentCommandState,
  type RemoveAssignmentDateInput,
  type RemoveDirectAssignmentInput,
} from '@/features/assignments/commands/types';

/** One id per logical decision; reuse it for transport retries of that decision. */
export const createAssignmentCommandId = (): string => crypto.randomUUID();

const RETRY_DELAYS_MS = [400, 1200];

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

export function removeDirectAssignment(input: RemoveDirectAssignmentInput): Promise<AssignmentCommandResult> {
  return execute(() => supabase.rpc('remove_direct_assignment', {
    p_command_id: input.commandId,
    p_job_id: input.jobId,
    p_technician_id: input.technicianId,
    p_expected_state_token: input.expectedStateToken ?? undefined,
    p_source: input.source ?? 'matrix',
  }));
}

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
