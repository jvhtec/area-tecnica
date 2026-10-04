// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { useMatrixJobFocus } from '@/features/matrix-v2/focus/useMatrixJobFocus';
import { JOB_A, JOB_B, TECH_1, TECH_2, makeJob, makeMatrixRow, makeResult, makeTechnician } from '@/features/matrix-v2/__tests__/fixtures';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import type { MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import { madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';

const toast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const TECH_3 = 'tech-3';
const dayKeys = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
const dates = dayKeys.map((key) => {
  const date = madridDateKeyToCalendarDate(key);
  if (!date) throw new Error(`bad date ${key}`);
  return date;
});
const slots = new Map<string, RoleSlot[]>([[JOB_A, [{ code: 'SND-MON-E', department: 'sound', required: 2, filled: 0, invited: 0, open: 2 }]]]);

const okOutcome = { ok: true as const, noop: false, result: makeResult(), undo: null };

function setup(options: {
  assignments?: MatrixTimesheetAssignment[];
  status?: 'invited' | 'confirmed';
  declined?: Map<string, Set<string>>;
  technicians?: ReturnType<typeof makeTechnician>[];
  focusJobId?: string | null;
  slotsByJob?: Map<string, RoleSlot[]>;
  ready?: boolean;
} = {}) {
  const run = vi.fn<MatrixCommandRunner['run']>().mockResolvedValue(okOutcome);
  const runner: MatrixCommandRunner = { run, releaseAll: vi.fn() };
  const openInspector = vi.fn();
  const technicians = options.technicians ?? [makeTechnician(TECH_1), makeTechnician(TECH_2), makeTechnician(TECH_3)];
  const props = {
    focusJobId: options.focusJobId === undefined ? JOB_A : options.focusJobId,
    status: options.status ?? 'invited' as const,
    ready: options.ready ?? true,
    jobs: [makeJob(JOB_A), makeJob(JOB_B)],
    technicians,
    dates,
    runner,
    getAssignmentForCell: (technicianId: string, date: Date) => (options.assignments ?? []).find((row) => row.technician_id === technicianId && row.date === dayKeys[dates.indexOf(date)]),
    getAvailabilityForCell: () => undefined,
    declinedJobsByTech: options.declined ?? new Map<string, Set<string>>(),
    roleSlotsByJob: options.slotsByJob ?? slots,
    lastRoleByTechnician: new Map<string, string>(),
    openInspector,
  };
  const view = renderHook((hookProps: typeof props) => useMatrixJobFocus(hookProps), { initialProps: props });
  return { view, props, run, openInspector };
}

describe('useMatrixJobFocus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is off without a focused job', () => {
    const { view } = setup({ focusJobId: null });
    expect(view.result.current.focus).toBeNull();
    const base = [makeTechnician('b'), makeTechnician('a')];
    expect(view.result.current.applyOrder(base)).toBe(base);
  });

  it('judges every technician against the job days on the grid', () => {
    const { view } = setup({
      assignments: [makeMatrixRow({ technician_id: TECH_2, job_id: JOB_B, date: '2026-10-13', job: makeJob(JOB_B) })],
      declined: new Map([[TECH_3, new Set([JOB_A])]]),
    });
    const focus = view.result.current.focus;
    expect(focus?.visibleJobDayKeys).toEqual(['2026-10-13', '2026-10-14']);
    expect(focus?.fits.get(TECH_1)).toMatchObject({ kind: 'free', label: 'Libre 2/2' });
    expect(focus?.fits.get(TECH_2)).toMatchObject({ kind: 'partial-free', label: 'Libre 1/2' });
    expect(focus?.fits.get(TECH_3)).toMatchObject({ kind: 'declined' });
  });

  it('sorts the rows once on entry and does not move them afterwards', () => {
    const technicians = [makeTechnician(TECH_3), makeTechnician(TECH_2), makeTechnician(TECH_1)];
    const { view, props } = setup({
      technicians,
      assignments: [makeMatrixRow({ technician_id: TECH_2, job_id: JOB_B, date: '2026-10-13', job: makeJob(JOB_B) })],
      declined: new Map([[TECH_3, new Set([JOB_A])]]),
    });
    const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);
    expect(ids(view.result.current.applyOrder(technicians))).toEqual([TECH_1, TECH_2, TECH_3]);

    // Tech 1 becomes busy on both days: the label follows, the row stays put.
    view.rerender({
      ...props,
      getAssignmentForCell: (technicianId: string, date: Date) => (technicianId === TECH_1 ? makeMatrixRow({ technician_id: TECH_1, job_id: JOB_B, date: dayKeys[dates.indexOf(date)], job: makeJob(JOB_B) }) : undefined),
    });
    expect(view.result.current.focus?.fits.get(TECH_1)?.kind).toBe('busy');
    expect(ids(view.result.current.applyOrder(technicians))).toEqual([TECH_1, TECH_2, TECH_3]);
  });

  it('waits for the grid data before sorting, and sorts again for another job', () => {
    const technicians = [makeTechnician(TECH_2), makeTechnician(TECH_1)];
    const { view, props } = setup({ technicians, ready: false });
    expect(view.result.current.applyOrder(technicians)).toBe(technicians);
    view.rerender({ ...props, ready: true });
    expect(view.result.current.applyOrder(technicians)).toHaveLength(2);
    view.rerender({ ...props, ready: true, focusJobId: null });
    expect(view.result.current.applyOrder(technicians)).toBe(technicians);
  });

  it('a click on a free day of the job assigns that day with the next open slot', () => {
    const { view, run } = setup();
    let handled = false;
    act(() => { handled = view.result.current.focus?.onCellClick(TECH_1, dates[1], null) ?? false; });
    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledWith({
      kind: 'assign', technicianId: TECH_1, jobId: JOB_A, role: 'SND-MON-E', status: 'invited',
      coverage: 'single', dates: ['2026-10-13'], mode: 'add', source: 'matrix-focus',
    });
  });

  it('leaves clicks outside the job, and on occupied days, to the inspector', () => {
    const { view, run } = setup({
      assignments: [makeMatrixRow({ technician_id: TECH_2, job_id: JOB_B, date: '2026-10-13', job: makeJob(JOB_B) })],
    });
    expect(view.result.current.focus?.onCellClick(TECH_1, dates[0], null)).toBe(false);
    expect(view.result.current.focus?.onCellClick(TECH_2, dates[1], null)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('never assigns someone who declined the job or sits in the fridge', () => {
    const { view, run } = setup({ declined: new Map([[TECH_3, new Set([JOB_A])]]) });
    expect(view.result.current.focus?.onCellClick(TECH_3, dates[1], null)).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('a click on the name assigns every free day, as full coverage when that is the whole job', () => {
    const { view, run } = setup({ status: 'confirmed' });
    act(() => view.result.current.focus?.onNameClick(TECH_1));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'assign', technicianId: TECH_1, status: 'confirmed', coverage: 'full', mode: 'add', source: 'matrix-focus',
    }));
  });

  it('a name click adds only the free days and keeps the role already held', () => {
    const { view, run } = setup({
      assignments: [makeMatrixRow({ technician_id: TECH_2, job_id: JOB_A, date: '2026-10-13', sound_role: 'SND-FOH-R' })],
    });
    act(() => view.result.current.focus?.onNameClick(TECH_2));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      technicianId: TECH_2, role: 'SND-FOH-R', coverage: 'single', dates: ['2026-10-14'],
    }));
  });

  it('a name click on someone who cannot be assigned says why instead', () => {
    const { view, run } = setup({ declined: new Map([[TECH_3, new Set([JOB_A])]]) });
    act(() => view.result.current.focus?.onNameClick(TECH_3));
    expect(run).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('rechazó'));
  });

  it('opens the inspector instead of guessing a pay level', () => {
    const technician = makeTechnician(TECH_1, { skills: [{ name: 'FOH', is_primary: true }, { name: 'Monitores' }] });
    const { view, run, openInspector } = setup({ technicians: [technician], slotsByJob: new Map() });
    act(() => { view.result.current.focus?.onCellClick(TECH_1, dates[1], null); });
    expect(run).not.toHaveBeenCalled();
    expect(openInspector).toHaveBeenCalledWith(TECH_1, dates[1], null);
    expect(toast.info).toHaveBeenCalled();
  });

  it('offers the way to the cell when a command is rejected', async () => {
    const { view, run, openInspector } = setup();
    run.mockResolvedValueOnce({ ok: false, code: 'conflict', message: 'Ya tiene otro trabajo', stale: false, conflict: null, result: null, retryable: false });
    await act(async () => { view.result.current.focus?.onCellClick(TECH_1, dates[1], null); });
    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe('Ya tiene otro trabajo');
    options.action.onClick();
    expect(openInspector).toHaveBeenCalledWith(TECH_1, dates[1], null);
  });
});
