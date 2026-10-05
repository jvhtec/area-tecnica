// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));

import { AssignmentCommandError, assignmentCommandStateKey, type AssignmentCommandResult } from '@/features/assignments/commands';
import { createMatrixCommandRunner, UNDO_WINDOW_MS, type MatrixCommandRunnerDeps, type RunnerCommands, type RunnerEffects } from '@/features/matrix-v2/commandRunner';
import { resetDeferredEffectsForTests } from '@/features/matrix-v2/deferredEffects';
import { STAFFING_SUMMARY_SCOPE } from '@/features/matrix-v2/pairPatch';
import type { MatrixIntent, MatrixRunOutcome } from '@/features/matrix-v2/types';
import { matrixAssignmentsQueryKey, type MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import {
  JOB_A, JOB_B, TECH_1, makeJob, makeMatrixRow, makeResult, makeRow, makeState, makeTechnician,
} from '@/features/matrix-v2/__tests__/fixtures';

const matrixKey = matrixAssignmentsQueryKey([JOB_A, JOB_B], [TECH_1], new Date('2026-10-11T22:00:00Z'), new Date('2026-10-18T22:00:00Z'));

const assignIntent = (overrides: Partial<Extract<MatrixIntent, { kind: 'assign' }>> = {}): MatrixIntent => ({
  kind: 'assign', technicianId: TECH_1, jobId: JOB_A, role: 'SND-FOH-E', status: 'invited', coverage: 'full', source: 'matrix-inspector', ...overrides,
});

type Mocks = {
  apply: Mock<RunnerCommands['applyDirectAssignment']>;
  status: Mock<RunnerCommands['setAssignmentStatus']>;
  role: Mock<RunnerCommands['changeAssignmentRole']>;
  remove: Mock<RunnerCommands['removeDirectAssignment']>;
  removeDate: Mock<RunnerCommands['removeAssignmentDate']>;
  unconfirm: Mock<RunnerCommands['unconfirmAssignment']>;
  getState: Mock<RunnerCommands['getAssignmentCommandState']>;
  runEffects: Mock<RunnerEffects['run']>;
  supersede: Mock<RunnerEffects['supersede']>;
  settled: Mock<NonNullable<MatrixCommandRunnerDeps['onEffectsSettled']>>;
};

function setup(initialState = makeState()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  queryClient.setQueryData<MatrixTimesheetAssignment[]>(matrixKey, []);
  queryClient.setQueryData([STAFFING_SUMMARY_SCOPE, 'a,b'], { summaries: [], assignments: [] });
  const mocks: Mocks = {
    apply: vi.fn<RunnerCommands['applyDirectAssignment']>(),
    status: vi.fn<RunnerCommands['setAssignmentStatus']>(),
    role: vi.fn<RunnerCommands['changeAssignmentRole']>(),
    remove: vi.fn<RunnerCommands['removeDirectAssignment']>(),
    removeDate: vi.fn<RunnerCommands['removeAssignmentDate']>(),
    unconfirm: vi.fn<RunnerCommands['unconfirmAssignment']>(),
    getState: vi.fn<RunnerCommands['getAssignmentCommandState']>().mockResolvedValue(initialState),
    runEffects: vi.fn<RunnerEffects['run']>().mockResolvedValue({ attempted: 2, failed: 0, recorded: true }),
    supersede: vi.fn<RunnerEffects['supersede']>().mockResolvedValue({ superseded: 2, not_superseded: 0, commands: [] }),
    settled: vi.fn<NonNullable<MatrixCommandRunnerDeps['onEffectsSettled']>>(),
  };
  const deps: MatrixCommandRunnerDeps = {
    queryClient,
    getJob: (id) => (id === JOB_A || id === JOB_B ? makeJob(id) : undefined),
    getTechnician: (id) => (id === TECH_1 ? makeTechnician(TECH_1) : undefined),
    commands: {
      applyDirectAssignment: mocks.apply, setAssignmentStatus: mocks.status, changeAssignmentRole: mocks.role,
      removeDirectAssignment: mocks.remove, removeAssignmentDate: mocks.removeDate, unconfirmAssignment: mocks.unconfirm,
      getAssignmentCommandState: mocks.getState,
    },
    effects: { run: mocks.runEffects, supersede: mocks.supersede },
    onEffectsSettled: mocks.settled,
  };
  return { runner: createMatrixCommandRunner(deps), queryClient, mocks };
}

const rowsOf = (queryClient: QueryClient) => queryClient.getQueryData<MatrixTimesheetAssignment[]>(matrixKey) ?? [];

const mustSucceed = (outcome: MatrixRunOutcome) => {
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.code}`);
  return outcome;
};

describe('createMatrixCommandRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDeferredEffectsForTests();
  });
  afterEach(() => {
    resetDeferredEffectsForTests();
    vi.useRealTimers();
  });

  describe('assign', () => {
    it('paints the prediction while the command is in flight, then the exact outcome', async () => {
      const { runner, queryClient, mocks } = setup();
      let finish: (value: AssignmentCommandResult) => void = () => undefined;
      mocks.apply.mockReturnValue(new Promise<AssignmentCommandResult>((resolve) => { finish = resolve; }));

      const pending = runner.run(assignIntent());
      await vi.advanceTimersByTimeAsync(0);
      expect(rowsOf(queryClient).map((row) => row.date).sort()).toEqual(['2026-10-13', '2026-10-14']);
      expect(rowsOf(queryClient)[0]).toMatchObject({ status: 'invited', sound_role: 'SND-FOH-E' });

      finish(makeResult({ dates: ['2026-10-13'], state_token: 'token-9' }));
      mustSucceed(await pending);
      expect(rowsOf(queryClient).map((row) => row.date)).toEqual(['2026-10-13']);
      expect(queryClient.getQueryData(assignmentCommandStateKey(JOB_A, TECH_1))).toMatchObject({ state_token: 'token-9', dates: ['2026-10-13'] });
    });

    it('loadState reads the pair once and the command that follows reuses it (a batch reads first, then removes)', async () => {
      const { runner, mocks } = setup(makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13', '2026-10-14'], state_token: 'read-token' }));
      mocks.remove.mockResolvedValue(makeResult());
      expect(await runner.loadState(JOB_A, TECH_1)).toMatchObject({ state_token: 'read-token', dates: ['2026-10-13', '2026-10-14'] });
      await runner.run({ kind: 'remove', technicianId: TECH_1, jobId: JOB_A, source: 'matrix-batch' });
      expect(mocks.getState).toHaveBeenCalledTimes(1);
      expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ expectedStateToken: 'read-token', source: 'matrix-batch' }));
    });

    it('sends the loaded state token, the intent and its source', async () => {
      const { runner, mocks } = setup(makeState({ state_token: 'loaded-token' }));
      mocks.apply.mockResolvedValue(makeResult());
      await runner.run(assignIntent({ coverage: 'multi', dates: ['2026-10-14'], mode: 'add', conflictPolicy: 'allow', status: 'confirmed' }));
      expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({
        jobId: JOB_A, technicianId: TECH_1, role: 'SND-FOH-E', status: 'confirmed', coverage: 'multi', dates: ['2026-10-14'],
        mode: 'add', conflictPolicy: 'allow', expectedStateToken: 'loaded-token', source: 'matrix-inspector',
      }));
    });

    it('holds the effects for the undo window, then runs them with the technician context', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(outcome.undo?.isOpen()).toBe(true);
      expect(mocks.runEffects).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
      expect(mocks.runEffects).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(mocks.runEffects).toHaveBeenCalledWith('command-1', expect.anything(), { technicianDepartment: 'sound', recipientName: expect.stringContaining('Marta') });
      expect(outcome.undo?.isOpen()).toBe(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.settled).toHaveBeenCalledWith('command-1', { attempted: 2, failed: 0, recorded: true });
    });

    it('rolls the grid back and reports the conflict a rejection carries', async () => {
      const { runner, queryClient, mocks } = setup();
      const before = rowsOf(queryClient);
      mocks.apply.mockResolvedValue(makeResult({
        ok: false, outcome: 'rejected', code: 'conflict', assignment: null, dates: [], side_effects: [],
        details: {
          target_date: null,
          conflict_dates: ['2026-10-14'],
          conflicts: {
            hasHardConflict: true, hasSoftConflict: false, unavailabilityConflicts: [], softConflicts: [],
            hardConflicts: [{ id: JOB_B, title: 'Otro', start_time: '2026-10-14T08:00:00Z', end_time: '2026-10-14T20:00:00Z', status: 'Confirmado' }],
          },
        },
      }));
      const outcome = await runner.run(assignIntent());
      expect(outcome).toMatchObject({ ok: false, code: 'conflict', stale: false });
      if (outcome.ok) throw new Error('unreachable');
      expect(outcome.conflict?.conflicts.hardConflicts[0].title).toBe('Otro');
      expect(rowsOf(queryClient)).toEqual(before);
      expect(mocks.runEffects).not.toHaveBeenCalled();
    });

    it('reports a stale pair as stale and refreshes its state', async () => {
      const { runner, queryClient, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult({ ok: false, outcome: 'rejected', code: 'stale_state', assignment: null, dates: [], side_effects: [] }));
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
      const outcome = await runner.run(assignIntent());
      expect(outcome).toMatchObject({ ok: false, code: 'stale_state', stale: true });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: assignmentCommandStateKey(JOB_A, TECH_1) });
    });

    it('fails closed when the state cannot be loaded', async () => {
      const { runner, mocks } = setup();
      mocks.getState.mockRejectedValue(new Error('boom'));
      const outcome = await runner.run(assignIntent());
      expect(outcome).toMatchObject({ ok: false, code: 'unknown', message: expect.stringContaining('No se pudo cargar el estado') });
      expect(mocks.apply).not.toHaveBeenCalled();
    });

    it('reuses the command id when the same decision is retried after a network failure', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockRejectedValueOnce(new AssignmentCommandError('network')).mockResolvedValue(makeResult());
      const first = await runner.run(assignIntent());
      expect(first).toMatchObject({ ok: false, code: 'network', retryable: true });
      await runner.run(assignIntent());
      const ids = mocks.apply.mock.calls.map(([input]) => input.commandId);
      expect(ids[0]).toBe(ids[1]);
    });

    it('uses a new command id after a definitive rejection', async () => {
      const { runner, mocks } = setup();
      mocks.apply
        .mockResolvedValueOnce(makeResult({ ok: false, outcome: 'rejected', code: 'invalid_role', assignment: null, dates: [], side_effects: [] }))
        .mockResolvedValue(makeResult());
      await runner.run(assignIntent());
      await runner.run(assignIntent());
      const ids = mocks.apply.mock.calls.map(([input]) => input.commandId);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('a no-op writes nothing, holds nothing and offers no undo', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult({ outcome: 'noop', side_effects: [] }));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(outcome).toMatchObject({ noop: true, undo: null });
    });

    it('a move cannot be undone: its effects run right away', async () => {
      const { runner, mocks } = setup(makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13'] }));
      mocks.apply.mockResolvedValue(makeResult({ moved_from: { job_id: JOB_B, deleted_timesheets: 1, deleted_assignment: true, assignment: makeRow() } }));
      const outcome = mustSucceed(await runner.run(assignIntent({ fromJobId: JOB_B })));
      expect(outcome.undo).toBeNull();
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.runEffects).toHaveBeenCalledTimes(1);
      expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ fromJobId: JOB_B }));
    });
  });

  describe('undo', () => {
    it('removes a new assignment with the post-change token and cancels both sets of effects', async () => {
      const { runner, mocks, queryClient } = setup();
      mocks.apply.mockResolvedValue(makeResult({ state_token: 'after-assign' }));
      mocks.remove.mockResolvedValue(makeResult({ command_id: 'undo-1', assignment: null, dates: [], state_token: 'after-undo', side_effects: [
        { kind: 'notification', action: 'assignment.removed', job_id: JOB_A, status: 'pending', effect_id: 'undo-1:0' },
      ] }));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(rowsOf(queryClient)).toHaveLength(2);

      const undone = await outcome.undo?.undo();
      expect(undone).toEqual({ ok: true });
      expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ jobId: JOB_A, technicianId: TECH_1, expectedStateToken: 'after-assign' }));
      expect(mocks.supersede).toHaveBeenNthCalledWith(1, ['command-1']);
      expect(mocks.supersede).toHaveBeenNthCalledWith(2, ['undo-1']);
      expect(rowsOf(queryClient)).toEqual([]);

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
      expect(mocks.runEffects).not.toHaveBeenCalled();
    });

    it('announces the inverse when the original effects had already run', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      mocks.remove.mockResolvedValue(makeResult({ command_id: 'undo-1', assignment: null, dates: [] }));
      mocks.supersede.mockResolvedValue({ superseded: 0, not_superseded: 2, commands: [] });
      const outcome = mustSucceed(await runner.run(assignIntent()));
      await outcome.undo?.undo();
      expect(mocks.supersede).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.runEffects).toHaveBeenCalledWith('undo-1', expect.anything(), expect.anything());
    });

    it('refuses after the window and leaves the change alone', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      const outcome = mustSucceed(await runner.run(assignIntent()));
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(await outcome.undo?.undo()).toMatchObject({ ok: false, reason: 'expired' });
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    it('a stale undo keeps the original effects: they run soon instead of being lost', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      mocks.remove.mockResolvedValue(makeResult({ ok: false, outcome: 'rejected', code: 'stale_state', assignment: null, dates: [], side_effects: [] }));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(await outcome.undo?.undo()).toMatchObject({ ok: false, reason: 'stale' });
      expect(mocks.supersede).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mocks.runEffects).toHaveBeenCalledWith('command-1', expect.anything(), expect.anything());
    });

    it('a transport failure while undoing also keeps the original effects', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      mocks.remove.mockRejectedValue(new AssignmentCommandError('network'));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(await outcome.undo?.undo()).toMatchObject({ ok: false, reason: 'failed' });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(mocks.runEffects).toHaveBeenCalledTimes(1);
    });

    it('lets both sets of effects run when they could not be cancelled', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      mocks.remove.mockResolvedValue(makeResult({ command_id: 'undo-1', assignment: null, dates: [] }));
      mocks.supersede.mockRejectedValue(new Error('rpc down'));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      expect(await outcome.undo?.undo()).toEqual({ ok: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.runEffects.mock.calls.map(([id]) => id).sort()).toEqual(['command-1', 'undo-1']);
    });

    it('can only be used once', async () => {
      const { runner, mocks } = setup();
      mocks.apply.mockResolvedValue(makeResult());
      mocks.remove.mockResolvedValue(makeResult({ command_id: 'undo-1', assignment: null, dates: [] }));
      const outcome = mustSucceed(await runner.run(assignIntent()));
      await outcome.undo?.undo();
      expect(await outcome.undo?.undo()).toMatchObject({ ok: false, reason: 'expired' });
      expect(mocks.remove).toHaveBeenCalledTimes(1);
    });

    it('restores the previous days and role when it was a modification', async () => {
      const previous = makeState({ exists: true, assignment: makeRow({ sound_role: 'SND-PA-T' }), dates: ['2026-10-13'], state_token: 'before' });
      const { runner, mocks } = setup(previous);
      mocks.apply
        .mockResolvedValueOnce(makeResult({ dates: ['2026-10-13', '2026-10-14'], assignment: makeRow({ sound_role: 'SND-FOH-E' }), state_token: 'after' }))
        .mockResolvedValueOnce(makeResult({ command_id: 'undo-1', dates: ['2026-10-13'], assignment: makeRow({ sound_role: 'SND-PA-T' }) }));
      const outcome = mustSucceed(await runner.run(assignIntent({ mode: 'add' })));
      await outcome.undo?.undo();
      expect(mocks.apply).toHaveBeenLastCalledWith(expect.objectContaining({
        role: 'SND-PA-T', coverage: 'multi', dates: ['2026-10-13'], mode: 'replace', expectedStateToken: 'after', status: 'invited',
      }));
    });

    it('offers no undo for a modification that needs two writes to reverse', async () => {
      const previous = makeState({ exists: true, assignment: makeRow({ status: 'invited', sound_role: 'SND-PA-T' }), dates: ['2026-10-13'] });
      const { runner, mocks } = setup(previous);
      mocks.apply.mockResolvedValue(makeResult({ assignment: makeRow({ status: 'confirmed', sound_role: 'SND-FOH-E' }), dates: ['2026-10-13', '2026-10-14'] }));
      const outcome = mustSucceed(await runner.run(assignIntent({ status: 'confirmed' })));
      expect(outcome.undo).toBeNull();
    });
  });

  describe('confirm, role, decline and removal', () => {
    const pair = makeState({ exists: true, assignment: makeRow({ status: 'invited' }), dates: ['2026-10-13', '2026-10-14'], state_token: 'before' });

    it('confirm is undone with unconfirm', async () => {
      const { runner, mocks, queryClient } = setup(pair);
      queryClient.setQueryData<MatrixTimesheetAssignment[]>(matrixKey, [makeMatrixRow({ date: '2026-10-13' }), makeMatrixRow({ date: '2026-10-14' })]);
      mocks.status.mockResolvedValue(makeResult({
        assignment: makeRow({ status: 'confirmed' }), state_token: 'after',
        side_effects: [{ kind: 'notification', action: 'job.assignment.confirmed', job_id: JOB_A, status: 'pending', effect_id: 'command-1:0' }],
      }));
      mocks.unconfirm.mockResolvedValue(makeResult({ command_id: 'undo-1', assignment: makeRow({ status: 'invited' }), side_effects: [] }));
      const outcome = mustSucceed(await runner.run({ kind: 'confirm', technicianId: TECH_1, jobId: JOB_A, source: 'matrix-keyboard' }));
      expect(mocks.status).toHaveBeenCalledWith(expect.objectContaining({ action: 'confirm', source: 'matrix-keyboard', expectedStateToken: 'before' }));
      expect(rowsOf(queryClient).every((row) => row.status === 'confirmed')).toBe(true);
      expect(await outcome.undo?.undo()).toEqual({ ok: true });
      expect(mocks.unconfirm).toHaveBeenCalledWith(expect.objectContaining({ expectedStateToken: 'after' }));
      expect(rowsOf(queryClient).every((row) => row.status === 'invited')).toBe(true);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
      expect(mocks.runEffects).not.toHaveBeenCalled();
    });

    it('confirming something already confirmed offers no undo', async () => {
      const { runner, mocks } = setup(makeState({ exists: true, assignment: makeRow({ status: 'confirmed' }), dates: ['2026-10-13'] }));
      mocks.status.mockResolvedValue(makeResult({ assignment: makeRow({ status: 'confirmed' }) }));
      const outcome = mustSucceed(await runner.run({ kind: 'confirm', technicianId: TECH_1, jobId: JOB_A, source: 'matrix-inspector' }));
      expect(outcome.undo).toBeNull();
    });

    it('confirming a declined assignment offers no undo: unconfirm would leave it invited', async () => {
      const { runner, mocks } = setup(makeState({ exists: true, assignment: makeRow({ status: 'declined' }), dates: [] }));
      mocks.status.mockResolvedValue(makeResult({ assignment: makeRow({ status: 'confirmed' }), dates: [] }));
      const outcome = mustSucceed(await runner.run({ kind: 'confirm', technicianId: TECH_1, jobId: JOB_A, source: 'matrix-inspector' }));
      expect(outcome.undo).toBeNull();
    });

    it('assigning over a declined membership offers no undo', async () => {
      const { runner, mocks } = setup(makeState({ exists: true, assignment: makeRow({ status: 'declined', sound_role: 'SND-FOH-E' }), dates: ['2026-10-13'] }));
      mocks.apply.mockResolvedValue(makeResult({ assignment: makeRow({ status: 'confirmed', sound_role: 'SND-FOH-E' }), dates: ['2026-10-13'] }));
      const outcome = mustSucceed(await runner.run(assignIntent({ status: 'confirmed', coverage: 'multi', dates: ['2026-10-13'] })));
      expect(outcome.undo).toBeNull();
      expect(mocks.unconfirm).not.toHaveBeenCalled();
    });

    it('a role change is undone by restoring the previous role', async () => {
      const { runner, mocks } = setup(makeState({ ...pair, assignment: makeRow({ sound_role: 'SND-PA-T' }) }));
      mocks.role.mockResolvedValueOnce(makeResult({ assignment: makeRow({ sound_role: 'SND-FOH-R' }), state_token: 'after', side_effects: [] }))
        .mockResolvedValueOnce(makeResult({ command_id: 'undo-1', assignment: makeRow({ sound_role: 'SND-PA-T' }), side_effects: [] }));
      const outcome = mustSucceed(await runner.run({ kind: 'role', technicianId: TECH_1, jobId: JOB_A, role: 'SND-FOH-R', department: 'sound', source: 'matrix-inspector' }));
      expect(outcome.undo).not.toBeNull();
      await outcome.undo?.undo();
      expect(mocks.role).toHaveBeenLastCalledWith(expect.objectContaining({ department: 'sound', role: 'SND-PA-T', expectedStateToken: 'after' }));
    });

    it('decline and removal are final: no undo, effects released at once', async () => {
      const { runner, mocks, queryClient } = setup(pair);
      queryClient.setQueryData<MatrixTimesheetAssignment[]>(matrixKey, [makeMatrixRow({ date: '2026-10-13' })]);
      mocks.remove.mockResolvedValue(makeResult({ assignment: null, dates: [], side_effects: [
        { kind: 'notification', action: 'assignment.removed', job_id: JOB_A, status: 'pending', effect_id: 'command-1:0' },
      ] }));
      const removal = mustSucceed(await runner.run({ kind: 'remove', technicianId: TECH_1, jobId: JOB_A, source: 'matrix-inspector' }));
      expect(removal.undo).toBeNull();
      expect(rowsOf(queryClient)).toEqual([]);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.runEffects).toHaveBeenCalledTimes(1);

      mocks.status.mockResolvedValue(makeResult({ command_id: 'command-2', assignment: makeRow({ status: 'declined' }), dates: [], side_effects: [] }));
      const decline = mustSucceed(await runner.run({ kind: 'decline', technicianId: TECH_1, jobId: JOB_A, notes: 'no puede', source: 'matrix-inspector' }));
      expect(decline.undo).toBeNull();
      expect(mocks.status).toHaveBeenCalledWith(expect.objectContaining({ action: 'decline', notes: 'no puede' }));
    });

    it('removing one day predicts the pair without it', async () => {
      const { runner, mocks, queryClient } = setup(pair);
      queryClient.setQueryData<MatrixTimesheetAssignment[]>(matrixKey, [makeMatrixRow({ date: '2026-10-13' }), makeMatrixRow({ date: '2026-10-14' })]);
      let finish: (value: AssignmentCommandResult) => void = () => undefined;
      mocks.removeDate.mockReturnValue(new Promise<AssignmentCommandResult>((resolve) => { finish = resolve; }));
      const pending = runner.run({ kind: 'remove-date', technicianId: TECH_1, jobId: JOB_A, date: '2026-10-13', source: 'matrix-inspector' });
      await vi.advanceTimersByTimeAsync(0);
      expect(rowsOf(queryClient).map((row) => row.date)).toEqual(['2026-10-14']);
      finish(makeResult({ dates: ['2026-10-14'], side_effects: [] }));
      mustSucceed(await pending);
    });

    it('a rejected removal restores the grid', async () => {
      const { runner, mocks, queryClient } = setup(pair);
      const rows = [makeMatrixRow({ date: '2026-10-13' }), makeMatrixRow({ date: '2026-10-14' })];
      queryClient.setQueryData<MatrixTimesheetAssignment[]>(matrixKey, rows);
      mocks.removeDate.mockResolvedValue(makeResult({ ok: false, outcome: 'rejected', code: 'approved_timesheet', assignment: null, dates: [], side_effects: [] }));
      const outcome = await runner.run({ kind: 'remove-date', technicianId: TECH_1, jobId: JOB_A, date: '2026-10-13', source: 'matrix-inspector' });
      expect(outcome).toMatchObject({ ok: false, code: 'approved_timesheet' });
      expect(rowsOf(queryClient)).toEqual(rows);
    });
  });

  it('releaseAll runs every held effect now', async () => {
    const { runner, mocks } = setup();
    mocks.apply.mockResolvedValue(makeResult());
    mustSucceed(await runner.run(assignIntent()));
    expect(mocks.runEffects).not.toHaveBeenCalled();
    runner.releaseAll();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.runEffects).toHaveBeenCalledTimes(1);
  });
});
