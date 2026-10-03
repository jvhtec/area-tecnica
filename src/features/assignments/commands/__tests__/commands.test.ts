import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, invokeMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), invokeMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock, functions: { invoke: invokeMock } },
}));

import {
  AssignmentCommandError,
  applyDirectAssignment,
  classifyAssignmentRpcError,
  requireCommitted,
  runAssignmentSideEffects,
  type AssignmentCommandResult,
} from '@/features/assignments/commands';

const result = (overrides: Partial<Record<string, unknown>> = {}) => ({
  ok: true,
  outcome: 'committed',
  command_id: 'cmd-1',
  job_id: 'job-1',
  technician_id: 'tech-1',
  state_token: 'token',
  replayed: false,
  assignment: {
    id: 'a-1', status: 'confirmed', sound_role: 'SND-FOH-R', lights_role: null, video_role: null,
    production_role: null, single_day: true, assignment_date: '2026-12-01', assignment_source: 'direct',
  },
  dates: ['2026-12-01'],
  side_effects: [],
  warnings: [],
  ...overrides,
});

const input = {
  commandId: 'cmd-1',
  jobId: 'job-1',
  technicianId: 'tech-1',
  role: 'SND-FOH-R',
  status: 'confirmed' as const,
  coverage: 'single' as const,
  dates: ['2026-12-01'],
};

beforeEach(() => {
  vi.useFakeTimers();
  rpcMock.mockReset();
  invokeMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('applyDirectAssignment', () => {
  it('maps the input onto the RPC contract', async () => {
    rpcMock.mockResolvedValue({ data: result(), error: null });
    await applyDirectAssignment({ ...input, expectedStateToken: 'tok', fromJobId: 'job-0' });
    expect(rpcMock).toHaveBeenCalledWith('apply_direct_assignment', expect.objectContaining({
      p_command_id: 'cmd-1',
      p_coverage: 'single',
      p_dates: ['2026-12-01'],
      p_mode: 'replace',
      p_expected_state_token: 'tok',
      p_from_job_id: 'job-0',
      p_conflict_policy: 'reject',
      p_source: 'assignment-dialog',
    }));
  });

  it('never sends client dates for full coverage', async () => {
    rpcMock.mockResolvedValue({ data: result(), error: null });
    await applyDirectAssignment({ ...input, coverage: 'full' });
    expect(rpcMock.mock.calls[0][1].p_dates).toBeUndefined();
  });

  it('retries network failures with the same command id and returns the replayed result', async () => {
    rpcMock
      .mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } })
      .mockResolvedValueOnce({ data: result({ replayed: true }), error: null });
    const pending = applyDirectAssignment(input);
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toMatchObject({ replayed: true });
    expect(rpcMock.mock.calls.map(([, args]) => args.p_command_id)).toEqual(['cmd-1', 'cmd-1']);
  });

  it('gives up after bounded retries with a retryable network error', async () => {
    rpcMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const pending = applyDirectAssignment(input);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'network', retryable: true });
    await vi.runAllTimersAsync();
    await assertion;
    expect(rpcMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry authorization or invalid-request errors', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(applyDirectAssignment(input)).rejects.toMatchObject({ code: 'permission_denied', retryable: false });
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('returns rejections as results and requireCommitted turns them into typed errors', async () => {
    rpcMock.mockResolvedValue({ data: result({ ok: false, outcome: 'rejected', code: 'stale_state' }), error: null });
    const rejected = await applyDirectAssignment(input);
    expect(rejected).toMatchObject({ ok: false, code: 'stale_state' });
    expect(() => requireCommitted(rejected)).toThrow(AssignmentCommandError);
    try {
      requireCommitted(rejected);
    } catch (error) {
      expect(error).toMatchObject({ code: 'stale_state', retryable: false });
    }
  });

  it('refuses an unrecognized response instead of guessing', async () => {
    rpcMock.mockResolvedValue({ data: { ok: 'yes' }, error: null });
    await expect(applyDirectAssignment(input)).rejects.toMatchObject({ code: 'unknown' });
  });
});

describe('classifyAssignmentRpcError', () => {
  it.each([
    [{ code: '22023', message: 'bad' }, 'invalid_request'],
    [{ code: '23505', message: 'command_id_reused' }, 'command_id_reused'],
    [{ code: '23505', message: 'duplicate key value' }, 'concurrent_write'],
    [{ code: '55P03', message: 'lock not available' }, 'concurrent_write'],
    [{ code: 'P0001', message: 'injected' }, 'unknown'],
  ])('maps %o to %s', (error, code) => {
    expect(classifyAssignmentRpcError(error).code).toBe(code);
  });
});

describe('runAssignmentSideEffects', () => {
  const committed = (effects: AssignmentCommandResult['side_effects']) => ({
    technician_id: 'tech-1',
    assignment: result().assignment,
    dates: ['2026-12-01'],
    removed: null,
    side_effects: effects,
  });

  it('executes the plan and records each outcome, keeping failures visible', async () => {
    vi.useRealTimers();
    invokeMock
      .mockResolvedValueOnce({ error: { message: 'Flex down' } })
      .mockResolvedValueOnce({ error: null });
    rpcMock.mockResolvedValue({ data: {}, error: null });

    const summary = await runAssignmentSideEffects('cmd-1', committed([
      { kind: 'flex', action: 'add', job_id: 'job-1', department: 'sound', status: 'pending' },
      { kind: 'notification', action: 'job.assignment.direct', job_id: 'job-1', status: 'pending' },
    ]), { technicianDepartment: 'sound', recipientName: 'Pat' });

    expect(summary).toEqual({ attempted: 2, failed: 1, recorded: true });
    expect(invokeMock).toHaveBeenCalledWith('manage-flex-crew-assignments', {
      body: { job_id: 'job-1', technician_id: 'tech-1', department: 'sound', action: 'add' },
    });
    expect(invokeMock).toHaveBeenCalledWith('push', { body: expect.objectContaining({
      type: 'job.assignment.direct', recipient_id: 'tech-1', recipient_name: 'Pat',
      assignment_status: 'confirmed', single_day: true, target_date: '2026-12-01T00:00:00Z', departments: ['sound'],
    }) });
    expect(rpcMock).toHaveBeenCalledWith('record_assignment_side_effects', {
      p_command_id: 'cmd-1',
      p_results: [
        { index: 0, status: 'failed', error: 'Flex down' },
        { index: 1, status: 'succeeded' },
      ],
    });
  });

  it('skips effects that already succeeded and records nothing when there is nothing to do', async () => {
    vi.useRealTimers();
    const summary = await runAssignmentSideEffects('cmd-1', committed([
      { kind: 'flex', action: 'add', job_id: 'job-1', department: 'sound', status: 'succeeded' },
    ]));
    expect(summary).toEqual({ attempted: 0, failed: 0, recorded: true });
    expect(invokeMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
