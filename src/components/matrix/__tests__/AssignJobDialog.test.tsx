import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AssignJobDialog } from '../AssignJobDialog';
import { fromMadridDateKey } from '@/utils/timezoneUtils';
import type { AssignmentCommandResult } from '@/features/assignments/commands';

const {
  useQueryMock,
  applyMock,
  removeMock,
  sideEffectsMock,
  createIdMock,
  toastFn,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  applyMock: vi.fn(),
  removeMock: vi.fn(),
  sideEffectsMock: vi.fn(),
  createIdMock: vi.fn(),
  toastFn: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('@/features/assignments/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/assignments/commands')>();
  return {
    ...actual,
    applyDirectAssignment: applyMock,
    removeDirectAssignment: removeMock,
    runAssignmentSideEffects: sideEffectsMock,
    createAssignmentCommandId: createIdMock,
    getAssignmentCommandState: vi.fn(),
  };
});

vi.mock('@/services/dataLayerClient', () => ({ dataLayerClient: {} }));

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

const otherJob = { ...baseJob, id: 'job-2', title: 'Other Event' };

const defaultTechnician = {
  first_name: 'Pat',
  last_name: 'Jones',
  department: 'sound',
};

const stateFor = (jobId: string) => ({
  exists: jobId === 'job-2',
  assignment: null,
  dates: [],
  state_token: `token-${jobId}`,
});

const committed = (overrides: Partial<AssignmentCommandResult> = {}): AssignmentCommandResult => ({
  ok: true,
  outcome: 'committed',
  command_id: 'cmd-1',
  job_id: 'job-1',
  technician_id: 'tech-1',
  state_token: 'token-after',
  replayed: false,
  assignment: {
    id: 'assignment-1', status: 'invited', sound_role: 'SND-FOH-R', lights_role: null, video_role: null,
    production_role: null, single_day: true, assignment_date: '2024-05-01', assignment_source: 'direct',
  },
  dates: ['2024-05-01'],
  side_effects: [{ kind: 'flex', action: 'add', job_id: 'job-1', department: 'sound', status: 'pending' }],
  warnings: [],
  ...overrides,
});

const conflictRejection: AssignmentCommandResult = {
  ok: false,
  outcome: 'rejected',
  code: 'conflict',
  command_id: 'cmd-1',
  job_id: 'job-1',
  technician_id: 'tech-1',
  state_token: 'token-job-1',
  replayed: false,
  assignment: null,
  dates: [],
  side_effects: [],
  warnings: [],
  details: {
    target_date: '2024-05-01',
    conflict_dates: ['2024-05-01'],
    conflicts: {
      hasHardConflict: true,
      hasSoftConflict: false,
      hardConflicts: [{
        id: 'conflict-1', title: 'Overlapping Show', start_time: '2024-05-01T08:00:00Z',
        end_time: '2024-05-01T20:00:00Z', status: 'confirmed',
      }],
      softConflicts: [],
      unavailabilityConflicts: [],
    },
  },
};

let idCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  idCounter = 0;
  createIdMock.mockImplementation(() => `cmd-${++idCounter}`);
  useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'technician') return { data: defaultTechnician, isLoading: false };
    if (queryKey[0] === 'assignment-command-state') {
      return queryKey[1] ? { data: stateFor(queryKey[1]), isLoading: false } : { data: undefined, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });
  applyMock.mockResolvedValue(committed());
  removeMock.mockResolvedValue(committed({ assignment: null, dates: [], side_effects: [] }));
  sideEffectsMock.mockResolvedValue({ attempted: 1, failed: 0, recorded: true });
});

afterEach(() => {
  cleanup();
});

const pickRole = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('option', { name: /foh\s+—\s+responsable/i }));
};

describe('AssignJobDialog direct-assignment command', () => {
  it('sends one atomic command with the loaded state token and runs side effects after commit', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-06-01T00:00:00Z')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(applyMock.mock.calls[0][0]).toMatchObject({
      commandId: 'cmd-1',
      jobId: 'job-1',
      technicianId: 'tech-1',
      role: 'SND-FOH-R',
      status: 'invited',
      coverage: 'full',
      expectedStateToken: 'token-job-1',
      fromJobId: null,
      conflictPolicy: 'reject',
    });
    expect(sideEffectsMock).toHaveBeenCalledWith('cmd-1', expect.objectContaining({ ok: true }),
      expect.objectContaining({ technicianDepartment: 'sound', recipientName: 'Pat Jones' }));
    expect(toastFn.success).toHaveBeenCalledWith(expect.stringContaining('(invitado)'));
  });

  it('shows the authoritative conflict and overrides only with a new explicit decision', async () => {
    applyMock.mockResolvedValueOnce(conflictRejection).mockResolvedValueOnce(conflictRejection);
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-05-01T00:00:00Z')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    expect(await screen.findByText(/conflicto de horario/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(sideEffectsMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /volver/i }));
    await waitFor(() => expect(screen.queryByText(/conflicto de horario/i)).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    expect(await screen.findByText(/conflicto de horario/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /forzar asignación de todos modos/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(applyMock).toHaveBeenCalledTimes(3);
    expect(applyMock.mock.calls[2][0]).toMatchObject({ conflictPolicy: 'allow' });
    // Each definitive outcome ends the decision, so every attempt has its own id.
    expect(applyMock.mock.calls.map(([input]) => input.commandId)).toEqual(['cmd-1', 'cmd-2', 'cmd-3']);
  });

  it('reuses the command id after a network failure so the retry replays instead of repeating', async () => {
    const { AssignmentCommandError } = await import('@/features/assignments/commands');
    applyMock.mockRejectedValueOnce(new AssignmentCommandError('network'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-06-01T00:00:00Z')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    await waitFor(() => expect(toastFn.error).toHaveBeenCalledWith(expect.stringMatching(/error de red/i)));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(applyMock.mock.calls.map(([input]) => input.commandId)).toEqual(['cmd-1', 'cmd-1']);
  });

  it('refuses to send a command when the authoritative state could not be loaded', async () => {
    useQueryMock.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'technician') return { data: defaultTechnician, isLoading: false };
      return { data: undefined, isLoading: false, isError: true };
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-06-01T00:00:00Z')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    await waitFor(() => expect(toastFn.error).toHaveBeenCalledWith(expect.stringMatching(/no se pudo cargar el estado actual/i)));
    expect(applyMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and explains a stale state rejection', async () => {
    applyMock.mockResolvedValueOnce({ ...conflictRejection, code: 'stale_state', details: {} });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-06-01T00:00:00Z')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));
    await waitFor(() => expect(toastFn.error).toHaveBeenCalledWith(expect.stringMatching(/otra persona ha modificado/i)));
    expect(onClose).not.toHaveBeenCalled();
    expect(sideEffectsMock).not.toHaveBeenCalled();
  });

  it('moves a reassignment in the same command instead of deleting first', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AssignJobDialog open onClose={onClose} technicianId="tech-1" date={new Date('2024-05-01T00:00:00Z')}
        availableJobs={[baseJob, otherJob]} preSelectedJobId="job-1"
        existingAssignment={{
          id: 'assignment-2', job_id: 'job-2', technician_id: 'tech-1', status: 'invited', sound_role: 'SND-FOH-R',
          lights_role: null, video_role: null, production_role: null, single_day: false, assignment_date: null,
          assigned_at: '2024-04-01T00:00:00Z', assigned_by: null, assignment_source: 'direct', response_time: null,
          use_tour_multipliers: false, external_technician_name: null, invoice_received_at: null, invoice_received_by: null,
        }} />
    );

    await user.click(screen.getByRole('button', { name: /reasignar trabajo|asignar trabajo/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(applyMock.mock.calls[0][0]).toMatchObject({
      jobId: 'job-1',
      fromJobId: 'job-2',
      expectedStateToken: 'token-job-1',
      expectedFromStateToken: 'token-job-2',
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  // Everything the pickers hold is a calendar day — a local midnight standing
  // for a date — because that is what react-day-picker renders and returns.
  // Keying those with formatDateKey converts them as instants into Madrid, so a
  // picked day was submitted one early east of Madrid. This pins the day that
  // actually reaches the command.
  it('submits the technician\'s own day for multi-day coverage', async () => {
    const user = userEvent.setup();
    render(
      <AssignJobDialog open onClose={vi.fn()} technicianId="tech-3"
        // The matrix passes the instant of Madrid midnight, not a local one.
        date={fromMadridDateKey('2024-05-01')}
        availableJobs={[baseJob]} preSelectedJobId="job-1" />
    );

    await pickRole(user);
    await user.click(screen.getByRole('tab', { name: /varios días/i }));
    await user.click(screen.getByRole('button', { name: /asignar trabajo/i }));

    await waitFor(() => expect(applyMock).toHaveBeenCalledTimes(1));
    expect(applyMock.mock.calls[0][0]).toMatchObject({ coverage: 'multi', dates: ['2024-05-01'] });
  });
});
