import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockQueryBuilder } from '@/test/mockSupabase';
import { useAssignJobMutations } from '../useAssignJobMutations';

const {
  fromMock,
  authGetUserMock,
  functionsInvokeMock,
  toggleTimesheetDayMock,
  removeTimesheetAssignmentMock,
  syncTimesheetCategoriesMock,
  getConflictWarningMock,
  determineFlexDepartmentsForAssignmentMock,
  toastFn,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  authGetUserMock: vi.fn(),
  functionsInvokeMock: vi.fn(),
  toggleTimesheetDayMock: vi.fn(),
  removeTimesheetAssignmentMock: vi.fn(),
  syncTimesheetCategoriesMock: vi.fn(),
  getConflictWarningMock: vi.fn(),
  determineFlexDepartmentsForAssignmentMock: vi.fn(),
  toastFn: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    auth: {
      getUser: authGetUserMock,
    },
    functions: {
      invoke: functionsInvokeMock,
    },
  },
}));

vi.mock('@/services/toggleTimesheetDay', () => ({
  toggleTimesheetDay: toggleTimesheetDayMock,
}));

vi.mock('@/services/removeTimesheetAssignment', () => ({
  removeTimesheetAssignment: removeTimesheetAssignmentMock,
}));

vi.mock('@/services/syncTimesheetCategories', () => ({
  syncTimesheetCategoriesForAssignment: syncTimesheetCategoriesMock,
}));

vi.mock('../conflictUtils', () => ({
  getConflictWarning: getConflictWarningMock,
}));

vi.mock('@/utils/flexCrewAssignments', () => ({
  determineFlexDepartmentsForAssignment: determineFlexDepartmentsForAssignmentMock,
}));

vi.mock('sonner', () => ({
  toast: toastFn,
}));

type SetupOptions = {
  existingRow?: Record<string, unknown> | null;
  verifyRows?: Array<{ job_id: string }>;
  freshTimesheets?: Array<{ date: string }>;
  jobData?: { start_time: string; end_time: string } | null;
};

const setupSupabase = ({
  existingRow = null,
  verifyRows = [{ job_id: 'job-1' }],
  freshTimesheets = [],
  jobData = {
    start_time: '2026-04-14T08:00:00.000Z',
    end_time: '2026-04-16T18:00:00.000Z',
  },
}: SetupOptions = {}) => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));
  const deleteMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));

  fromMock.mockImplementation((table: string) => {
    if (table === 'job_assignments') {
      return {
        select: vi.fn((columns: string) => {
          if (columns === 'job_id, technician_id, single_day, assignment_date, status') {
            return createMockQueryBuilder({
              data: existingRow,
              error: null,
            });
          }

          if (columns === 'job_id') {
            return createMockQueryBuilder({
              data: verifyRows,
              error: null,
            });
          }

          return createMockQueryBuilder({
            data: null,
            error: null,
          });
        }),
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      };
    }

    if (table === 'timesheets') {
      return {
        select: vi.fn(() => createMockQueryBuilder({
          data: freshTimesheets,
          error: null,
        })),
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
      };
    }

    if (table === 'jobs') {
      return {
        select: vi.fn(() => createMockQueryBuilder({
          data: jobData,
          error: null,
        })),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { insertMock, updateMock, deleteMock };
};

const baseProps = () => ({
  selectedJobId: 'job-1',
  selectedRole: 'foh',
  technicianId: 'tech-1',
  technician: {
    first_name: 'Pat',
    last_name: 'Jones',
    department: 'sound',
  },
  selectedJob: {
    id: 'job-1',
    title: 'Madrid Arena',
    start_time: '2026-04-14T08:00:00.000Z',
    end_time: '2026-04-16T18:00:00.000Z',
    status: 'Confirmado',
  },
  existingAssignment: undefined,
  isReassignment: false,
  isModifyingSameJobByContext: false,
  isModifyingSelectedJob: false,
  isLoadingExistingTimesheets: false,
  existingTimesheets: [],
  coverageMode: 'full' as const,
  assignmentDate: '2026-04-14',
  multiDates: [],
  modificationMode: 'add' as const,
  assignAsConfirmed: false,
  setConflictWarning: vi.fn(),
  onClose: vi.fn(),
});

describe('useAssignJobMutations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    authGetUserMock.mockResolvedValue({ data: { user: { id: 'manager-1' } } });
    functionsInvokeMock.mockResolvedValue({ data: null, error: null });
    toggleTimesheetDayMock.mockResolvedValue(undefined);
    removeTimesheetAssignmentMock.mockResolvedValue({ deleted_assignment: true, deleted_timesheets: 0 });
    syncTimesheetCategoriesMock.mockResolvedValue(undefined);
    getConflictWarningMock.mockResolvedValue(null);
    determineFlexDepartmentsForAssignmentMock.mockReturnValue(['sound']);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('creates a full-span assignment and toggles one timesheet per job day', async () => {
    const { insertMock } = setupSupabase();
    const props = baseProps();

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 'job-1',
      technician_id: 'tech-1',
      sound_role: 'foh',
      single_day: false,
      assignment_date: null,
      status: 'invited',
      assignment_source: 'direct',
    }));
    expect(toggleTimesheetDayMock).toHaveBeenCalledTimes(3);
    expect(toggleTimesheetDayMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ dateIso: '2026-04-14', present: true }));
    expect(toggleTimesheetDayMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ dateIso: '2026-04-15', present: true }));
    expect(toggleTimesheetDayMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ dateIso: '2026-04-16', present: true }));
    expect(syncTimesheetCategoriesMock).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1',
      technicianId: 'tech-1',
      soundRole: 'foh',
    }));
    expect(functionsInvokeMock).toHaveBeenCalledWith('manage-flex-crew-assignments', expect.objectContaining({
      body: expect.objectContaining({
        job_id: 'job-1',
        technician_id: 'tech-1',
        department: 'sound',
        action: 'add',
      }),
    }));
    expect(functionsInvokeMock).toHaveBeenCalledWith('push', expect.objectContaining({
      body: expect.objectContaining({
        type: 'job.assignment.direct',
        job_id: 'job-1',
        recipient_id: 'tech-1',
        single_day: false,
      }),
    }));
    expect(toastFn.success).toHaveBeenCalledWith(expect.stringContaining('Asignado Pat Jones a Madrid Arena'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('adds only missing dates when extending the same job in multi-day add mode', async () => {
    const existingRow = {
      job_id: 'job-1',
      technician_id: 'tech-1',
      single_day: true,
      assignment_date: '2026-04-14',
      status: 'invited',
    };
    const { updateMock } = setupSupabase({
      existingRow,
      freshTimesheets: [{ date: '2026-04-14' }],
    });
    const props = {
      ...baseProps(),
      coverageMode: 'multi' as const,
      multiDates: [
        new Date('2026-04-14T00:00:00.000Z'),
        new Date('2026-04-15T00:00:00.000Z'),
        new Date('2026-04-15T12:00:00.000Z'),
      ],
      isModifyingSelectedJob: true,
      existingTimesheets: ['2026-04-14'],
    };

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      single_day: true,
      assignment_date: '2026-04-14',
      assignment_source: 'direct',
    }));
    expect(toggleTimesheetDayMock).toHaveBeenCalledTimes(1);
    expect(toggleTimesheetDayMock).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1',
      technicianId: 'tech-1',
      dateIso: '2026-04-15',
      present: true,
    }));
  });

  it('replaces existing dates when modifying the same job in replace mode', async () => {
    const existingRow = {
      job_id: 'job-1',
      technician_id: 'tech-1',
      single_day: true,
      assignment_date: '2026-04-14',
      status: 'invited',
    };
    setupSupabase({
      existingRow,
      freshTimesheets: [{ date: '2026-04-14' }, { date: '2026-04-15' }],
    });
    const props = {
      ...baseProps(),
      coverageMode: 'multi' as const,
      multiDates: [
        new Date('2026-04-15T00:00:00.000Z'),
        new Date('2026-04-16T00:00:00.000Z'),
      ],
      isModifyingSelectedJob: true,
      modificationMode: 'replace' as const,
      existingTimesheets: ['2026-04-14', '2026-04-15'],
    };

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toggleTimesheetDayMock).toHaveBeenCalledTimes(2);
    expect(toggleTimesheetDayMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      dateIso: '2026-04-14',
      present: false,
    }));
    expect(toggleTimesheetDayMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      dateIso: '2026-04-16',
      present: true,
    }));
  });

  it('reassigns from another job and removes prior crew links before creating the new assignment', async () => {
    const { insertMock, deleteMock } = setupSupabase({
      verifyRows: [{ job_id: 'job-2' }],
    });
    removeTimesheetAssignmentMock.mockResolvedValueOnce({ deleted_assignment: false, deleted_timesheets: 0 });
    determineFlexDepartmentsForAssignmentMock.mockReturnValue(['sound', 'lights']);
    const props = {
      ...baseProps(),
      selectedJobId: 'job-2',
      selectedJob: {
        id: 'job-2',
        title: 'Nueva Ruta',
        start_time: '2026-04-15T08:00:00.000Z',
        end_time: '2026-04-15T18:00:00.000Z',
        status: 'Confirmado',
      },
      existingAssignment: {
        job_id: 'job-old',
        sound_role: 'foh',
      },
      isReassignment: true,
      coverageMode: 'single' as const,
      assignmentDate: '2026-04-15',
      multiDates: [],
    };

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(removeTimesheetAssignmentMock).toHaveBeenCalledWith({ jobId: 'job-old', technicianId: 'tech-1' });
    expect(deleteMock).toHaveBeenCalled();
    expect(functionsInvokeMock).toHaveBeenCalledWith('manage-flex-crew-assignments', expect.objectContaining({
      body: expect.objectContaining({
        job_id: 'job-old',
        technician_id: 'tech-1',
        action: 'remove',
      }),
    }));
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      job_id: 'job-2',
      single_day: true,
      assignment_date: '2026-04-15',
    }));
  });

  it('removes an assignment and dispatches the success flow', async () => {
    setupSupabase();
    determineFlexDepartmentsForAssignmentMock.mockReturnValue(['sound']);
    const onClose = vi.fn();
    const props = {
      ...baseProps(),
      existingAssignment: {
        job_id: 'job-1',
        sound_role: 'foh',
      },
      isReassignment: true,
      onClose,
    };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.handleRemoveAssignment();
    });

    expect(removeTimesheetAssignmentMock).toHaveBeenCalledWith({ jobId: 'job-1', technicianId: 'tech-1' });
    expect(functionsInvokeMock).toHaveBeenCalledWith('manage-flex-crew-assignments', expect.objectContaining({
      body: expect.objectContaining({
        job_id: 'job-1',
        technician_id: 'tech-1',
        department: 'sound',
        action: 'remove',
      }),
    }));
    expect(toastFn.success).toHaveBeenCalledWith('Asignación eliminada');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'assignment-updated',
    }));
    expect(onClose).toHaveBeenCalled();

    dispatchSpy.mockRestore();
  });
});
