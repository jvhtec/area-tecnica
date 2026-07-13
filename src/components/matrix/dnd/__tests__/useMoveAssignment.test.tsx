// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '@/test/mockSupabase';
import { useMoveAssignment } from '@/components/matrix/dnd/useMoveAssignment';
import type { DragSource } from '@/components/matrix/dnd/useMatrixDrag';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  invoke: vi.fn(),
  checkConflict: vi.fn(),
  toggleDay: vi.fn(),
  removeAssignment: vi.fn(),
  syncCategories: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
    functions: { invoke: mocks.invoke },
  },
}));
vi.mock('@/utils/technicianAvailability', () => ({ checkTimeConflictEnhanced: mocks.checkConflict }));
vi.mock('@/services/toggleTimesheetDay', () => ({ toggleTimesheetDay: mocks.toggleDay }));
vi.mock('@/services/removeTimesheetAssignment', () => ({ removeTimesheetAssignment: mocks.removeAssignment }));
vi.mock('@/services/syncTimesheetCategories', () => ({ syncTimesheetCategoriesForAssignment: mocks.syncCategories }));
vi.mock('sonner', () => ({ toast: mocks.toast }));

const source: DragSource = {
  technicianId: 'source-tech',
  technicianName: 'Source Tech',
  dateKey: '2026-07-15',
  jobId: 'job-1',
  jobTitle: 'Festival',
  roles: {
    sound_role: 'foh',
    lights_role: 'lights-tech',
    video_role: null,
    production_role: 'producer',
  },
  status: 'confirmed',
  department: 'sound',
};

const preparePendingMove = async () => {
  const hook = renderHook(() => useMoveAssignment());
  await act(async () => hook.result.current.requestMove(source, 'target-tech', 'Target Tech'));
  await waitFor(() => expect(hook.result.current.pendingMove).not.toBeNull());
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkConflict.mockResolvedValue({
    hasHardConflict: false,
    hasSoftConflict: false,
    hardConflicts: [],
    softConflicts: [],
    unavailabilityConflicts: [],
  });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'manager-1' } }, error: null });
  mocks.invoke.mockResolvedValue({ data: null, error: null });
  mocks.syncCategories.mockResolvedValue(undefined);
  mocks.toggleDay.mockResolvedValue(undefined);
  mocks.removeAssignment.mockResolvedValue({ deleted_assignment: true, deleted_timesheets: 1 });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'timesheets') return createMockQueryBuilder({ data: [], error: null });
    if (table === 'job_assignments') return createMockQueryBuilder({ data: null, error: null });
    return createMockQueryBuilder();
  });
});

describe('useMoveAssignment', () => {
  it('attaches the target before removing the source and preserves all role columns', async () => {
    const order: string[] = [];
    mocks.toggleDay.mockImplementation(async () => { order.push('attach-target'); });
    mocks.removeAssignment.mockImplementation(async () => {
      order.push('detach-source');
      return { deleted_assignment: true, deleted_timesheets: 1 };
    });
    const jobBuilder = createMockQueryBuilder({ data: null, error: null });
    jobBuilder.insert.mockImplementation((payload) => {
      expect(payload).toEqual(expect.objectContaining(source.roles));
      return jobBuilder;
    });
    mocks.from.mockImplementation((table: string) => table === 'timesheets'
      ? createMockQueryBuilder({ data: [], error: null })
      : jobBuilder);
    const hook = await preparePendingMove();

    await act(async () => hook.result.current.commitMove());

    expect(order).toEqual(['attach-target', 'detach-source']);
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it('keeps the source and rolls back a newly created target when attachment fails', async () => {
    mocks.toggleDay.mockRejectedValueOnce(new Error('target timesheet failed'));
    const hook = await preparePendingMove();

    await act(async () => hook.result.current.commitMove());

    expect(mocks.removeAssignment).toHaveBeenCalledTimes(1);
    expect(mocks.removeAssignment).toHaveBeenCalledWith({ jobId: 'job-1', technicianId: 'target-tech' });
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining('original se mantiene'));
  });

  it('retains the attached target when source detachment fails', async () => {
    mocks.removeAssignment.mockRejectedValueOnce(new Error('source removal failed'));
    const hook = await preparePendingMove();

    await act(async () => hook.result.current.commitMove());

    expect(mocks.removeAssignment).toHaveBeenCalledTimes(1);
    expect(mocks.removeAssignment).toHaveBeenCalledWith({ jobId: 'job-1', technicianId: 'source-tech' });
    expect(mocks.toast.error).toHaveBeenCalledWith(expect.stringContaining('copia de destino'));
  });
});
