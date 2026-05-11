import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createMockQueryBuilder } from '@/test/mockSupabase';
import { AssignJobDialog } from '../AssignJobDialog';

const {
  useQueryMock,
  checkTimeConflictEnhancedMock,
  insertMock,
  deleteMock,
  upsertMock,
  fromMock,
  authGetUserMock,
  functionsInvokeMock,
  toastFn,
  toggleTimesheetDayMock,
  removeTimesheetAssignmentMock,
  syncTimesheetCategoriesMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  checkTimeConflictEnhancedMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
  upsertMock: vi.fn(),
  fromMock: vi.fn(),
  authGetUserMock: vi.fn(),
  functionsInvokeMock: vi.fn(),
  toastFn: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
  toggleTimesheetDayMock: vi.fn(),
  removeTimesheetAssignmentMock: vi.fn(),
  syncTimesheetCategoriesMock: vi.fn(),
}));

type ConflictCheckResult = {
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hardConflicts: Array<{ id: string; title: string; start_time: string; end_time: string; status: string }>;
  softConflicts: Array<{ id: string; title: string; start_time: string; end_time: string; status: string }>;
  unavailabilityConflicts: Array<{ date: string; reason: string; source: string; notes?: string }>;
};

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
  };
});

vi.mock('@/utils/technicianAvailability', async () => {
  const actual = await vi.importActual<typeof import('@/utils/technicianAvailability')>('@/utils/technicianAvailability');
  return {
    ...actual,
    checkTimeConflictEnhanced: checkTimeConflictEnhancedMock,
  };
});

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

vi.mock('sonner', () => ({
  toast: toastFn,
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

const baseJob = {
  id: 'job-1',
  title: 'Main Event',
  start_time: '2024-05-01T10:00:00Z',
  end_time: '2024-05-02T02:00:00Z',
  status: 'scheduled',
};

const defaultTechnician = {
  first_name: 'Pat',
  last_name: 'Jones',
  department: 'sound',
};

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockImplementation(({ queryKey }: { queryKey: any[] }) => {
    const key = queryKey[0];
    if (key === 'technician') {
      return { data: defaultTechnician, isLoading: false };
    }
    if (key === 'existing-timesheets') {
      return { data: [], isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });
  insertMock.mockResolvedValue({ error: null });
  deleteMock.mockResolvedValue({ error: null });
  upsertMock.mockResolvedValue({ error: null });
  toggleTimesheetDayMock.mockResolvedValue(undefined);
  removeTimesheetAssignmentMock.mockResolvedValue({ deleted_assignment: true, deleted_timesheets: 0 });
  syncTimesheetCategoriesMock.mockResolvedValue(undefined);
  fromMock.mockImplementation((table: string) => {
    if (table === 'job_assignments') {
      return {
        select: vi.fn((columns: string) => {
          if (columns === 'job_id') {
            return createMockQueryBuilder({
              data: [{ job_id: baseJob.id }],
              error: null,
            });
          }

          return createMockQueryBuilder({
            data: null,
            error: null,
          });
        }),
        insert: insertMock,
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        update: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
      };
    }

    if (table === 'timesheets') {
      return {
        upsert: upsertMock,
        delete: vi.fn(() => createMockQueryBuilder({ data: null, error: null })),
        select: vi.fn(() =>
          createMockQueryBuilder({
            data: [],
            error: null,
          }),
        ),
      };
    }

    if (table === 'jobs') {
      return {
        select: vi.fn(() =>
          createMockQueryBuilder({
            data: {
              start_time: baseJob.start_time,
              end_time: baseJob.end_time,
            },
            error: null,
          }),
        ),
      };
    }

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
  authGetUserMock.mockResolvedValue({ data: { user: { id: 'manager-1' } } });
  functionsInvokeMock.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  cleanup();
});

describe('AssignJobDialog conflict handling', () => {
  it('prompts for confirmation when a conflict is detected before proceeding', async () => {
    const conflictResult: ConflictCheckResult = {
      hasHardConflict: true,
      hasSoftConflict: false,
      hardConflicts: [{
        id: 'conflict-1',
        title: 'Overlapping Show',
        start_time: '2024-05-01T08:00:00Z',
        end_time: '2024-05-01T20:00:00Z',
        status: 'confirmed',
      }],
      softConflicts: [],
      unavailabilityConflicts: [],
    };
    checkTimeConflictEnhancedMock.mockResolvedValue(conflictResult);

    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AssignJobDialog
        open
        onClose={onClose}
        technicianId="tech-1"
        date={new Date('2024-05-01T00:00:00Z')}
        availableJobs={[baseJob]}
        preSelectedJobId="job-1"
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /foh\s+—\s+responsable/i }));

    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));

    expect(await screen.findByText(/conflicto de horario/i)).toBeInTheDocument();
    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith('tech-1', 'job-1', expect.objectContaining({ includePending: true }));
    expect(insertMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /volver/i }));

    await waitFor(() => {
      expect(screen.queryByText(/conflicto de horario/i)).not.toBeInTheDocument();
    });
    expect(insertMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    expect(await screen.findByText(/conflicto de horario/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /forzar asignación de todos modos/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledTimes(2);
  });

  it('creates the assignment immediately when no conflict exists', async () => {
    const noConflictResult: ConflictCheckResult = {
      hasHardConflict: false,
      hasSoftConflict: false,
      hardConflicts: [],
      softConflicts: [],
      unavailabilityConflicts: [],
    };
    checkTimeConflictEnhancedMock.mockResolvedValue(noConflictResult);

    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <AssignJobDialog
        open
        onClose={onClose}
        technicianId="tech-2"
        date={new Date('2024-06-01T00:00:00Z')}
        availableJobs={[baseJob]}
        preSelectedJobId="job-1"
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /foh\s+—\s+responsable/i }));

    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith('tech-2', 'job-1', expect.objectContaining({ includePending: true }));
    expect(screen.queryByText(/conflicto de horario/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
