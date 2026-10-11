// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';
import type { BatchLookups } from '@/features/matrix-v2/batch/plan';
import type { UnavailabilityResult } from '@/features/matrix-v2/unavailability';
import type { MatrixRunOutcome } from '@/features/matrix-v2/types';
import { makeJob, makeResult, makeRow, makeState, makeTechnician } from '@/features/matrix-v2/__tests__/fixtures';
import { useMatrixBatch } from '@/features/matrix-v2/batch/useMatrixBatch';
import { BatchActionBar } from '@/features/matrix-v2/batch/BatchActionBar';
import { planStaffingRows } from '@/features/matrix-v2/batch/plan';

const mocks = vi.hoisted(() => ({
  unavailable: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/features/matrix-v2/unavailability', () => ({ markUnavailableManyWithUndo: mocks.unavailable }));
vi.mock('@/features/matrix-v2/undoToast', () => ({ showUndoToast: vi.fn() }));
vi.mock('@/features/staffing/hooks/useStaffing', () => ({ ConflictError: class extends Error {} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const ok = (): MatrixRunOutcome => ({ ok: true, noop: false, result: makeResult(), undo: null });
function fixture(assigned = false, selected = new Set(['tech-1-2026-10-13'])) {
  const job = makeJob('job-a');
  const lookups: BatchLookups = {
    technician: id => makeTechnician(id),
    job: () => job,
    assignmentOn: () => assigned ? { job_id: job.id, status: 'invited', sound_role: 'SND-FOH-E' } : undefined,
    isUnavailable: () => false,
    isFridge: () => false,
    declinedJobIds: () => new Set(),
    roleSlots: () => [],
    lastRole: () => null,
  };
  const runner: MatrixCommandRunner = {
    run: vi.fn<MatrixCommandRunner['run']>().mockResolvedValue(ok()),
    loadState: vi.fn<MatrixCommandRunner['loadState']>().mockResolvedValue(makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13', '2026-10-14'] })),
    releaseAll: vi.fn(),
  };
  const v2: MatrixV2ViewConfig = {
    runner, roleSlotsByJob: new Map(), lastRoleByTechnician: new Map(), inspectorTarget: null,
    toggleInspector: vi.fn(), openInspector: vi.fn(), closeInspector: vi.fn(), quickConfirm: vi.fn(), toggleUnavailable: vi.fn(),
    focus: null, setFocusJob: vi.fn(), toggleFocusJob: vi.fn(),
  };
  const clearSelection = vi.fn();
  const options = { v2, canEdit: true, selectedCells: selected, clearSelection, lookups, jobs: [job] };
  return { options, runner, clearSelection };
}
function setup(assigned = false, selected?: Set<string>) {
  const data = fixture(assigned, selected);
  return { ...renderHook(() => useMatrixBatch(data.options)), ...data };
}
function Harness({ options }: { options: ReturnType<typeof fixture>['options'] }) {
  const batch = useMatrixBatch(options);
  return <BatchActionBar
    cells={options.selectedCells.size} people={1} canEdit running={batch.running} progress={batch.progress}
    jobs={batch.eligibleJobs} removal={batch.removal} onAssign={batch.assignTo} onRequest={batch.requestStaffing}
    channel="email" onChannelChange={() => undefined} onConfirm={batch.confirm} onRemove={() => { void batch.remove(); }}
    onMarkUnavailable={() => { void batch.markUnavailable(); }} onClear={options.clearSelection}
  />;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unavailable.mockReset();
});

describe('batch operation lifetime', () => {
  it('opens a needs-role offer with its draft in the fifth inspector argument', () => {
    const { result, options } = setup();
    const [row] = planStaffingRows(options.selectedCells, 'job-a', 'offer', 'whatsapp', null, options.lookups);
    expect(row.status).toBe('needs-role');
    act(() => { result.current.openRow(row); });
    expect(options.v2.openInspector).toHaveBeenCalledWith('tech-1', expect.any(Date), null, undefined, {
      jobId: 'job-a', phase: 'offer', days: ['2026-10-13'], channel: 'whatsapp', department: null, message: '',
    });
  });

  it('disables the rendered bar throughout pending availability and recovers after rejection', async () => {
    const response = deferred<UnavailabilityResult>();
    mocks.unavailable.mockReturnValue(response.promise);
    const { options } = fixture();
    render(<Harness options={options} />);
    const action = screen.getByRole('button', { name: 'No disponible' });
    fireEvent.click(action);
    fireEvent.click(action);
    expect(mocks.unavailable).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('batch-bar')).toHaveTextContent('Aplicando…');
    for (const button of within(screen.getByTestId('batch-bar')).getAllByRole('button')) expect(button).toBeDisabled();
    await act(async () => { response.reject(new Error('availability failed')); });
    for (const button of within(screen.getByTestId('batch-bar')).getAllByRole('button')) expect(button).toBeEnabled();
  });

  it('disables the rendered bar before removal has returned its first state read', async () => {
    const state = deferred<Awaited<ReturnType<MatrixCommandRunner['loadState']>>>();
    const { options, runner } = fixture(true);
    vi.mocked(runner.loadState).mockReturnValue(state.promise);
    render(<Harness options={options} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    const confirm = screen.getByRole('button', { name: 'Quitar' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(runner.loadState).toHaveBeenCalledTimes(1);
    expect(runner.run).not.toHaveBeenCalled();
    expect(screen.getByTestId('batch-bar')).toHaveTextContent('Aplicando…');
    for (const button of within(screen.getByTestId('batch-bar')).getAllByRole('button')) expect(button).toBeDisabled();
    await act(async () => { state.reject(new Error('state failed')); });
    for (const button of within(screen.getByTestId('batch-bar')).getAllByRole('button')) expect(button).toBeEnabled();
  });

  it('locks availability synchronously before a rerender, even with no progress rows', async () => {
    const response = deferred<UnavailabilityResult>();
    mocks.unavailable.mockReturnValue(response.promise);
    const { result, runner, clearSelection } = setup();
    let pending!: Promise<void>;
    act(() => {
      const action = result.current.markUnavailable;
      pending = action();
      void action();
      result.current.confirm();
      result.current.assignTo('job-a', 'invited');
      void result.current.remove();
    });
    expect(mocks.unavailable).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(true);
    expect(result.current.progress).toBeNull();
    expect(runner.run).not.toHaveBeenCalled();
    expect(clearSelection).not.toHaveBeenCalled();
    await act(async () => { response.resolve({ ok: true }); await pending; });
    expect(result.current.running).toBe(false);
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('releases availability after rejection and accepts a later operation', async () => {
    const response = deferred<UnavailabilityResult>();
    mocks.unavailable.mockReturnValueOnce(response.promise).mockResolvedValue({ ok: true });
    const { result, clearSelection } = setup();
    let pending!: Promise<void>;
    act(() => { pending = result.current.markUnavailable(); });
    await act(async () => { response.reject(new Error('availability failed')); await pending; });
    expect(result.current.running).toBe(false);
    expect(mocks.toast.error).toHaveBeenCalledWith('availability failed');
    await act(async () => { await result.current.markUnavailable(); });
    expect(mocks.unavailable).toHaveBeenCalledTimes(2);
    expect(clearSelection).toHaveBeenCalledTimes(2);
  });

  it('locks repeated removal before state reads and keeps the lock through commands', async () => {
    const state = deferred<Awaited<ReturnType<MatrixCommandRunner['loadState']>>>();
    const command = deferred<MatrixRunOutcome>();
    const { result, runner, clearSelection } = setup(true);
    vi.mocked(runner.loadState).mockReturnValue(state.promise);
    vi.mocked(runner.run).mockReturnValue(command.promise);
    let pending!: Promise<void>;
    act(() => {
      const action = result.current.remove;
      pending = action();
      void action();
      void result.current.markUnavailable();
      result.current.confirm();
    });
    expect(runner.loadState).toHaveBeenCalledTimes(1);
    expect(runner.run).not.toHaveBeenCalled();
    expect(result.current.running).toBe(true);
    expect(result.current.progress).toBeNull();
    expect(clearSelection).not.toHaveBeenCalled();
    await act(async () => {
      state.resolve(makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13', '2026-10-14'] }));
      await state.promise;
    });
    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
    expect(result.current.running).toBe(true);
    expect(result.current.progress).toEqual({ done: 0, total: 1 });
    act(() => { void result.current.remove(); result.current.confirm(); });
    expect(runner.loadState).toHaveBeenCalledTimes(1);
    expect(runner.run).toHaveBeenCalledTimes(1);
    await act(async () => { command.resolve(ok()); await pending; });
    expect(result.current.running).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });

  it('recovers after a rejected removal state read, preserving the skipped result', async () => {
    const state = deferred<Awaited<ReturnType<MatrixCommandRunner['loadState']>>>();
    const { result, runner } = setup(true);
    vi.mocked(runner.loadState).mockReturnValueOnce(state.promise);
    let pending!: Promise<void>;
    act(() => { pending = result.current.remove(); });
    await act(async () => { state.reject(new Error('state failed')); await pending; });
    expect(result.current.running).toBe(false);
    expect(runner.run).not.toHaveBeenCalled();
    expect(result.current.problems[0]).toMatchObject({ status: 'skipped' });
    await act(async () => { await result.current.remove(); });
    expect(runner.loadState).toHaveBeenCalledTimes(2);
    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
  });

  it('recovers after a rejected removal command and allows another attempt', async () => {
    const command = deferred<MatrixRunOutcome>();
    const { result, runner } = setup(true);
    vi.mocked(runner.run).mockReturnValueOnce(command.promise);
    let pending!: Promise<void>;
    act(() => { pending = result.current.remove(); });
    await waitFor(() => expect(runner.run).toHaveBeenCalledTimes(1));
    await act(async () => { command.reject(new Error('command failed')); await pending; });
    expect(result.current.running).toBe(false);
    expect(result.current.problems[0]).toMatchObject({ status: 'failed' });
    await act(async () => { await result.current.remove(); });
    expect(runner.run).toHaveBeenCalledTimes(2);
  });

  it('preserves row progress while an ordinary two-person batch completes', async () => {
    const first = deferred<MatrixRunOutcome>(), second = deferred<MatrixRunOutcome>();
    const { result, runner } = setup(true, new Set(['tech-1-2026-10-13', 'tech-2-2026-10-13']));
    vi.mocked(runner.run).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    act(() => { result.current.confirm(); result.current.confirm(); });
    expect(runner.run).toHaveBeenCalledTimes(2);
    expect(result.current.progress).toEqual({ done: 0, total: 2 });
    await act(async () => { first.resolve(ok()); await first.promise; });
    await waitFor(() => expect(result.current.progress).toEqual({ done: 1, total: 2 }));
    await act(async () => { second.resolve(ok()); await second.promise; });
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.progress).toBeNull();
  });
});
