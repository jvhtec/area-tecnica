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

vi.mock('@/components/matrix/assign-job-dialog/conflictUtils', () => ({
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
  existingRowError?: { message: string } | null;
  verifyRows?: Array<{ job_id: string }>;
  freshTimesheets?: Array<{ date: string }>;
  jobData?: { start_time: string; end_time: string } | null;
  jobDataError?: { message: string } | null;
  insertError?: { code?: string; message: string } | null;
  timesheetUpsertError?: { message: string } | null;
  timesheetDeleteError?: { message: string } | null;
};

const setupSupabase = ({
  existingRow = null,
  existingRowError = null,
  verifyRows = [{ job_id: 'job-1' }],
  freshTimesheets = [],
  jobData = {
    start_time: '2026-04-14T08:00:00.000Z',
    end_time: '2026-04-16T18:00:00.000Z',
  },
  jobDataError = null,
  insertError = null,
  timesheetUpsertError = null,
  timesheetDeleteError = null,
}: SetupOptions = {}) => {
  const insertMock = vi.fn().mockResolvedValue({ error: insertError });
  const updateMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));
  const deleteMock = vi.fn(() => createMockQueryBuilder({ data: null, error: null }));
  const timesheetUpsertMock = vi.fn(() => createMockQueryBuilder({ data: null, error: timesheetUpsertError }));
  const timesheetDeleteMock = vi.fn(() => createMockQueryBuilder({ data: null, error: timesheetDeleteError }));

  fromMock.mockImplementation((table: string) => {
    if (table === 'job_assignments') {
      return {
        select: vi.fn((columns: string) => {
          if (columns === 'job_id, technician_id, single_day, assignment_date, status') {
            return createMockQueryBuilder({
              data: existingRow,
              error: existingRowError,
            });
          }

          if (columns === 'job_id, technician_id, single_day, assignment_date, status, response_time') {
            return createMockQueryBuilder({
              data: existingRow,
              error: existingRowError,
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
        upsert: timesheetUpsertMock,
        delete: timesheetDeleteMock,
      };
    }

    if (table === 'jobs') {
      return {
        select: vi.fn(() => createMockQueryBuilder({
          data: jobData,
          error: jobDataError,
        })),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return { insertMock, updateMock, deleteMock, timesheetUpsertMock, timesheetDeleteMock };
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
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

  it('creates a full-span assignment and synchronizes one timesheet per job day', async () => {
    const { insertMock, timesheetUpsertMock, timesheetDeleteMock } = setupSupabase();
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
    expect(timesheetUpsertMock).toHaveBeenCalledWith([
      expect.objectContaining({ job_id: 'job-1', technician_id: 'tech-1', date: '2026-04-14', source: 'assignment-dialog', status: 'draft', is_active: true }),
      expect.objectContaining({ job_id: 'job-1', technician_id: 'tech-1', date: '2026-04-15', source: 'assignment-dialog', status: 'draft', is_active: true }),
      expect.objectContaining({ job_id: 'job-1', technician_id: 'tech-1', date: '2026-04-16', source: 'assignment-dialog', status: 'draft', is_active: true }),
    ], { onConflict: 'job_id,technician_id,date' });
    expect(timesheetDeleteMock).not.toHaveBeenCalled();
    expect(toggleTimesheetDayMock).not.toHaveBeenCalled();
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

  it('shows a user-facing error if conflict lookup fails before assignment starts', async () => {
    setupSupabase();
    getConflictWarningMock.mockRejectedValueOnce(new Error('Fallo al comprobar conflictos'));
    const props = baseProps();

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toastFn.error).toHaveBeenCalledWith('Fallo al comprobar conflictos');
    expect(result.current.isAssigning).toBe(false);
  });

  it('does not unlock the UI when the timeout fires before the write settles', async () => {
    const deferred = createDeferred<{ error: null }>();
    setupSupabase();
    fromMock.mockImplementation((table: string) => {
      if (table === 'job_assignments') {
        return {
          select: vi.fn((columns: string) => {
            if (columns === 'job_id, technician_id, single_day, assignment_date, status, response_time') {
              return createMockQueryBuilder({ data: null, error: null });
            }
            if (columns === 'job_id') {
              return createMockQueryBuilder({ data: [{ job_id: 'job-1' }], error: null });
            }
            return createMockQueryBuilder({ data: null, error: null });
          }),
          insert: vi.fn().mockReturnValue(deferred.promise),
          update: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
          delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        };
      }

      if (table === 'timesheets') {
        return {
          select: vi.fn(() => createMockQueryBuilder({ data: [], error: null })),
          upsert: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
          delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        };
      }

      if (table === 'jobs') {
        return {
          select: vi.fn(() => createMockQueryBuilder({
            data: {
              start_time: '2026-04-14T08:00:00.000Z',
              end_time: '2026-04-16T18:00:00.000Z',
            },
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

    const { result } = renderHook(() => useAssignJobMutations(baseProps()));

    let attemptPromise: Promise<void>;
    await act(async () => {
      attemptPromise = result.current.attemptAssign();
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(toastFn.error).toHaveBeenCalledWith('La asignación está tardando más de lo esperado. Espera a que termine antes de reintentar.');
    expect(result.current.isAssigning).toBe(true);

    await act(async () => {
      deferred.resolve({ error: null });
      await attemptPromise!;
    });

    expect(result.current.isAssigning).toBe(false);
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

  it('aborts when checking the existing assignment row fails', async () => {
    setupSupabase({
      existingRowError: { message: 'boom existing row' },
    });

    const { result } = renderHook(() => useAssignJobMutations(baseProps()));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toastFn.error).toHaveBeenCalledWith('Error al asignar el trabajo: No se pudo comprobar la asignación existente: boom existing row');
  });

  it('aborts when loading full-span job coverage fails', async () => {
    setupSupabase({
      jobDataError: { message: 'boom job data' },
    });

    const { result } = renderHook(() => useAssignJobMutations(baseProps()));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toastFn.error).toHaveBeenCalledWith('Error al asignar el trabajo: No se pudo cargar la cobertura del trabajo: boom job data');
  });

  it('aborts when the full-span job range is invalid', async () => {
    setupSupabase({
      jobData: {
        start_time: '2026-04-16T08:00:00.000Z',
        end_time: '2026-04-14T18:00:00.000Z',
      },
    });

    const { result } = renderHook(() => useAssignJobMutations(baseProps()));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toastFn.error).toHaveBeenCalledWith(
      'Error al asignar el trabajo: El rango de fechas del trabajo no es válido para generar la cobertura',
    );
  });

  it('localizes the success status text to Spanish', async () => {
    setupSupabase();
    const props = {
      ...baseProps(),
      assignAsConfirmed: true,
    };

    const { result } = renderHook(() => useAssignJobMutations(props));

    await act(async () => {
      await result.current.attemptAssign();
    });

    expect(toastFn.success).toHaveBeenCalledWith('Asignado Pat Jones a Madrid Arena (confirmado)');
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
