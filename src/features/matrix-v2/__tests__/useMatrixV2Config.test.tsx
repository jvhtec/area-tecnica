// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixCommandRunner } from '@/features/matrix-v2/commandRunner';
import { useMatrixV2Config } from '@/features/matrix-v2/useMatrixV2Config';
import { buildJobRoleSlots, type RoleSlotAssignmentRow } from '@/features/matrix-v2/roleSlots';
import { JOB_A, JOB_B, TECH_1, TECH_2, makeJob, makeResult, makeTechnician } from '@/features/matrix-v2/__tests__/fixtures';

const mocks = vi.hoisted(() => ({ runner: { run: vi.fn(), releaseAll: vi.fn(), loadState: vi.fn() } }));
vi.mock('@/features/matrix-v2/useMatrixCommandRunner', () => ({ useMatrixCommandRunner: () => mocks.runner }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const summaries = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 2 }] }];
const technicians = [makeTechnician(TECH_1), makeTechnician(TECH_2)];
const date = new Date('2026-10-14T12:00:00+02:00');
const outcome = { ok: true as const, noop: false, result: makeResult(), undo: null };

function setup() {
  const options = {
    enabled: true, ready: true, jobs: [makeJob(JOB_A)], technicians, dates: [date], baseOrderedTechnicians: technicians,
    allAssignments: [], getAssignmentForCell: () => undefined, getAvailabilityForCell: () => undefined,
    isManagementUser: true, declinedJobsByTech: new Map<string, Set<string>>(), focusJobId: JOB_A, focusStatus: 'invited' as const,
  };
  return renderHook(({ assignments }: { assignments: RoleSlotAssignmentRow[] }) => useMatrixV2Config({
    ...options, staffingAssignments: assignments, roleSlotsByJob: buildJobRoleSlots(summaries, assignments),
  }), { initialProps: { assignments: [] as RoleSlotAssignmentRow[] } });
}

beforeEach(() => { vi.clearAllMocks(); mocks.runner.run.mockResolvedValue(outcome); });

describe('useMatrixV2Config staffing membership', () => {
  it('counts a successful reservation once when the summary arrives before the grid', async () => {
    let finish!: (value: Awaited<ReturnType<MatrixCommandRunner['run']>>) => void;
    const pending = new Promise<Awaited<ReturnType<MatrixCommandRunner['run']>>>(resolve => { finish = resolve; });
    mocks.runner.run.mockReturnValueOnce(pending);
    const { result, rerender } = setup();
    act(() => result.current.v2Config?.focus?.onNameClick(TECH_1));
    rerender({ assignments: [{ job_id: JOB_A, technician_id: TECH_1, sound_role: 'SND-MON-E', status: 'invited' }] });
    act(() => {
      result.current.v2Config?.focus?.onNameClick(TECH_1);
      result.current.v2Config?.focus?.onNameClick(TECH_2);
    });
    expect(mocks.runner.run.mock.calls.map(([intent]) => intent.technicianId)).toEqual([TECH_1, TECH_2]);
    await act(async () => { finish(outcome); await pending; });
    rerender({ assignments: [] });
    await act(async () => { result.current.v2Config?.focus?.onNameClick(TECH_1); });
    expect(mocks.runner.run).toHaveBeenCalledTimes(3);
  });

  it.each([
    { job_id: JOB_A, technician_id: TECH_1, sound_role: 'SND-MON-E', status: 'declined' },
    { job_id: JOB_A, technician_id: TECH_1, sound_role: 'SND-MON-E', status: 'DECLINED' },
    { job_id: JOB_B, technician_id: TECH_1, sound_role: 'SND-MON-E', status: 'invited' },
    { job_id: JOB_A, technician_id: 'other-tech', sound_role: 'SND-MON-E', status: 'invited' },
    { job_id: JOB_A, technician_id: TECH_1, sound_role: 'SND-FOH-E', status: 'invited' },
  ])('does not release a reservation for unrelated or declined summary membership: %j', async assignment => {
    const { result, rerender } = setup();
    await act(async () => { result.current.v2Config?.focus?.onNameClick(TECH_1); });
    rerender({ assignments: [assignment] });
    act(() => result.current.v2Config?.focus?.onNameClick(TECH_1));
    expect(mocks.runner.run).toHaveBeenCalledTimes(1);
  });
});
