import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssignJobDialog } from '../AssignJobDialog';

const {
  useQueryMock,
  checkTimeConflictEnhancedMock,
  insertMock,
  deleteMock,
  updateMock,
  fromMock,
  authGetUserMock,
  functionsInvokeMock,
  removeTimesheetAssignmentMock,
  toastFn,
} = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return {
    useQueryMock: vi.fn(),
    checkTimeConflictEnhancedMock: vi.fn(),
    insertMock: vi.fn(),
    deleteMock: vi.fn(),
    updateMock: vi.fn(),
    fromMock: vi.fn(),
    authGetUserMock: vi.fn(),
    functionsInvokeMock: vi.fn(),
    removeTimesheetAssignmentMock: vi.fn(),
    toastFn: toast,
  };
});

type ConflictCheckResult = {
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hardConflicts: Array<{ id: string; title: string; start_time: string; end_time: string; status: string }>;
  softConflicts: Array<{ id: string; title: string; start_time: string; end_time: string; status: string }>;
  unavailabilityConflicts: Array<{ date: string; reason: string; source: string; notes?: string }>;
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
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

vi.mock('@/lib/supabase', () => ({
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

vi.mock('@/services/removeTimesheetAssignment', () => ({
  removeTimesheetAssignment: removeTimesheetAssignmentMock,
}));

vi.mock('sonner', () => ({
  toast: toastFn,
}));

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
});

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
  useQueryMock.mockReturnValue({ data: defaultTechnician });
  insertMock.mockResolvedValue({ error: null });
  deleteMock.mockResolvedValue({ error: null });
  updateMock.mockResolvedValue({ error: null });
  removeTimesheetAssignmentMock.mockResolvedValue({
    deleted_timesheets: 3,
    deleted_assignment: true,
  });
  fromMock.mockImplementation((table: string) => {
    if (table === 'job_assignments') {
      const selectExistingChain: any = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      const selectVerifyChain: any = {
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ job_id: 'job-1' }], error: null }),
      };
      return {
        insert: insertMock,
        delete: deleteMock,
        update: updateMock,
        select: vi.fn().mockImplementation((columns?: string) => {
          if (columns && columns.includes('technician_id')) {
            return selectExistingChain;
          }
          return selectVerifyChain;
        }),
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

    const roleTrigger = screen.getByText(/choose a role/i).closest('button');
    if (!roleTrigger) throw new Error('role select trigger not found');
    await user.click(roleTrigger);
    const [roleOption] = await screen.findAllByText(/foh/i);
    await user.click(roleOption);

    await user.click(screen.getByRole('button', { name: /assign job/i }));

    expect(await screen.findByText(/scheduling conflict/i)).toBeInTheDocument();
    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith('tech-1', 'job-1', expect.objectContaining({ includePending: true }));
    expect(insertMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /go back/i }));

    await waitFor(() => {
      expect(screen.queryByText(/scheduling conflict/i)).not.toBeInTheDocument();
    });
    expect(insertMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /assign job/i }));
    expect(await screen.findByText(/scheduling conflict/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /(force assign anyway|proceed anyway)/i }));

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

    const roleTrigger = screen.getByText(/choose a role/i).closest('button');
    if (!roleTrigger) throw new Error('role select trigger not found');
    await user.click(roleTrigger);
    const [roleOption] = await screen.findAllByText(/foh/i);
    await user.click(roleOption);

    await user.click(screen.getByRole('button', { name: /assign job/i }));

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
    expect(checkTimeConflictEnhancedMock).toHaveBeenCalledWith('tech-2', 'job-1', expect.objectContaining({ includePending: true }));
    expect(screen.queryByText(/scheduling conflict/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('removes assignments via the timesheet cleanup helper', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const existingAssignment = {
      job_id: 'job-legacy',
      technician_id: 'tech-99',
      status: 'confirmed',
    };

    render(
      <AssignJobDialog
        open
        onClose={onClose}
        technicianId="tech-99"
        date={new Date('2024-07-01T00:00:00Z')}
        availableJobs={[baseJob]}
        existingAssignment={existingAssignment}
        preSelectedJobId="job-1"
      />
    );

    await user.click(screen.getByRole('button', { name: /remove assignment/i }));

    await waitFor(() => {
      expect(removeTimesheetAssignmentMock).toHaveBeenCalledWith('job-legacy', 'tech-99');
    });
    expect(deleteMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(toastFn.success).toHaveBeenCalledWith('Assignment removed');
    });
    expect(onClose).toHaveBeenCalled();
  });
});
