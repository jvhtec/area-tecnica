import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssignJobDialog } from '../AssignJobDialog';

const useQueryMock = vi.fn();
const checkTimeConflictEnhancedMock = vi.fn();
const insertMock = vi.fn();
const deleteMock = vi.fn();
const fromMock = vi.fn();
const authGetUserMock = vi.fn();
const functionsInvokeMock = vi.fn();
const toastFn = Object.assign(vi.fn(), {
  error: vi.fn(),
  success: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: toastFn,
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
  useQueryMock.mockReturnValue({ data: defaultTechnician });
  insertMock.mockResolvedValue({ error: null });
  deleteMock.mockResolvedValue({ error: null });
  fromMock.mockImplementation((table: string) => {
    if (table === 'job_assignments') {
      return {
        insert: insertMock,
        delete: deleteMock,
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

    await user.click(screen.getByRole('button', { name: /choose a role/i }));
    await user.click(screen.getByText(/foh/i));

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

    await user.click(screen.getByRole('button', { name: /choose a role/i }));
    await user.click(screen.getByText(/foh/i));

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
});
