// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  showUndoToast: vi.fn(),
  markUnavailable: vi.fn(),
  clearUnavailable: vi.fn(),
  toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn(), success: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: mocks.toast, Toaster: (): null => null }));
vi.mock('@/features/matrix-v2/undoToast', () => ({ showUndoToast: mocks.showUndoToast }));
vi.mock('@/features/matrix-v2/unavailability', () => ({
  markUnavailableWithUndo: mocks.markUnavailable,
  clearUnavailableWithUndo: mocks.clearUnavailable,
}));
vi.mock('@/features/assignments/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/assignments/commands')>()),
  getAssignmentCommandState: mocks.getState,
}));

import { CellInspectorBody } from '@/features/matrix-v2/inspector/CellInspectorBody';
import type { InspectorEnvironment, InspectorTarget, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import type { MatrixIntent, MatrixRunOutcome } from '@/features/matrix-v2/types';
import { buildJobRoleSlots } from '@/features/matrix-v2/roleSlots';
import { JOB_A, JOB_B, TECH_1, makeJob, makeMatrixRow, makeResult, makeRow, makeState } from '@/features/matrix-v2/__tests__/fixtures';

const technician: InspectorTechnician = {
  id: TECH_1, first_name: 'Marta', last_name: 'Ibáñez', nickname: null, department: 'sound',
  skills: [{ name: 'Monitores', is_primary: true }],
};
const DATE_KEY = '2026-10-14';
const target = (): InspectorTarget => ({ technicianId: TECH_1, date: new Date('2026-10-13T22:00:00Z'), dateKey: DATE_KEY, anchor: null });

const okOutcome = (overrides: Partial<Extract<MatrixRunOutcome, { ok: true }>> = {}): MatrixRunOutcome => ({
  ok: true, noop: false, result: makeResult(), undo: { commandId: 'command-1', expiresAt: Date.now() + 8000, isOpen: () => true, undo: vi.fn(), release: vi.fn() }, ...overrides,
});

interface Setup {
  jobs?: ReturnType<typeof makeJob>[];
  assignment?: ReturnType<typeof makeMatrixRow>;
  availability?: { status?: string; reason?: string; source?: string };
  fridge?: boolean;
  declined?: string[];
  canAssign?: boolean;
  run?: (intent: MatrixIntent) => Promise<MatrixRunOutcome>;
  state?: ReturnType<typeof makeState> | Error;
  slots?: Parameters<typeof buildJobRoleSlots>[0];
  focusJobId?: string;
}

function setup(options: Setup = {}) {
  const jobs = options.jobs ?? [makeJob(JOB_A)];
  const run = vi.fn(options.run ?? (() => Promise.resolve(okOutcome())));
  const onClose = vi.fn();
  const openStaffing = vi.fn();
  if (options.state instanceof Error) mocks.getState.mockRejectedValue(options.state);
  else mocks.getState.mockResolvedValue(options.state ?? makeState());
  const env: InspectorEnvironment = {
    runner: { run, releaseAll: vi.fn(), loadState: vi.fn() },
    getTechnician: (id) => (id === TECH_1 ? technician : undefined),
    getJob: (id) => jobs.find((job) => job.id === id),
    getJobsForDate: () => jobs,
    getAssignmentForCell: () => options.assignment,
    getAvailabilityForCell: () => options.availability,
    roleSlotsByJob: buildJobRoleSlots(options.slots ?? [], []),
    lastRoleByTechnician: new Map(),
    declinedJobIds: () => new Set(options.declined ?? []),
    isFridge: () => options.fridge ?? false,
    staffingByDate: () => null,
    profileNames: new Map([['manager-1', 'Ana Villar']]),
    canAssign: options.canAssign ?? true,
    canMarkUnavailable: options.canAssign ?? true,
    focusJobId: options.focusJobId,
    openStaffing,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <CellInspectorBody env={env} target={target()} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { run, onClose, openStaffing, user };
}

const assignedRow = makeMatrixRow({ date: DATE_KEY, status: 'invited', assigned_by: 'manager-1', assigned_at: '2026-10-02T16:40:00Z' });
const assignedState = makeState({ exists: true, assignment: makeRow({ status: 'invited', sound_role: 'SND-PA-T' }), dates: ['2026-10-13', '2026-10-14'], state_token: 'tok' });

beforeEach(() => vi.clearAllMocks());

describe('empty cell', () => {
  it('preselects the only job, suggests the open slot, and assigns the whole job as invited', async () => {
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }, { role_code: 'SND-PA-T', quantity: 2 }] }];
    const { run, onClose, user } = setup({ slots });
    const assign = await screen.findByRole('button', { name: 'Asignar' });
    expect(screen.getByRole('radio', { name: /Trabajo job-a/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Monitores — Especialista, sugerido/ })).toBeChecked();
    await waitFor(() => expect(assign).toBeEnabled());

    await user.click(assign);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'assign', technicianId: TECH_1, jobId: JOB_A, role: 'SND-MON-E', status: 'invited', coverage: 'full',
      mode: 'replace', conflictPolicy: 'reject', source: 'matrix-inspector',
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.showUndoToast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Marta') }));
  });

  it('"Asignar confirmado" sends confirmed', async () => {
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }];
    const { run, user } = setup({ slots });
    await user.click(await screen.findByRole('button', { name: 'Asignar confirmado' }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
  });

  it('sends a single day, or a list, when the strip is changed', async () => {
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }];
    const { run, user } = setup({ slots });
    await screen.findByRole('button', { name: 'Asignar' });
    await user.click(screen.getByRole('button', { name: 'Solo este día' }));
    await user.click(screen.getByRole('button', { name: 'Asignar' }));
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ coverage: 'single', dates: [DATE_KEY] }));
  });

  it('asks for a job when several run that day, and does not guess a pay level', async () => {
    const { run, user } = setup({ jobs: [makeJob(JOB_A), makeJob(JOB_B, { title: 'Otro' })] });
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Trabajo job-a/ }));
    await screen.findByRole('button', { name: 'Asignar' });
    // Monitores matches MON-R? No: only MON-E and MON-R exist for sound; with no slot the level is ambiguous.
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeDisabled();
    expect(screen.getByText('Elige un rol para continuar.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Monitores — Especialista/ }));
    expect(screen.getByRole('button', { name: 'Asignar' })).toBeEnabled();
    expect(run).not.toHaveBeenCalled();
  });

  it('disables a job the technician declined and says why', () => {
    setup({ jobs: [makeJob(JOB_A), makeJob(JOB_B, { title: 'Otro' })], declined: [JOB_A] });
    expect(screen.getByRole('radio', { name: /Trabajo job-a.*Rechazó este trabajo/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Otro/ })).toBeEnabled();
  });

  it('prefers the focused job', async () => {
    setup({ jobs: [makeJob(JOB_A), makeJob(JOB_B, { title: 'Otro' })], focusJobId: JOB_B });
    expect(await screen.findByRole('radio', { name: /Otro/ })).toBeChecked();
  });

  it('shows the conflict the server found and keeps the attempted status when forcing', async () => {
    let calls = 0;
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }];
    const { run, user } = setup({
      slots,
      run: () => {
        calls += 1;
        if (calls > 1) return Promise.resolve(okOutcome());
        return Promise.resolve({
          ok: false, code: 'conflict', message: 'x', stale: false, retryable: false, result: null,
          conflict: {
            conflict_dates: ['2026-10-14'],
            conflicts: {
              hasHardConflict: true, hasSoftConflict: false, softConflicts: [], unavailabilityConflicts: [],
              hardConflicts: [{ id: 'j9', title: 'Gala Arce', start_time: '2026-10-14T08:00:00Z', end_time: '2026-10-14T20:00:00Z', status: 'Confirmado' }],
            },
          },
        });
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Asignar confirmado' }));
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/Gala Arce/)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /Solo días libres/ })).toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Forzar asignación' }));
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'confirmed', conflictPolicy: 'allow' }));
  });

  it('sends only the free days when asked', async () => {
    let calls = 0;
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }];
    const { run, user } = setup({
      slots,
      run: () => {
        calls += 1;
        return Promise.resolve(calls > 1 ? okOutcome() : {
          ok: false, code: 'conflict', message: 'x', stale: false, retryable: false, result: null,
          conflict: { conflict_dates: ['2026-10-14'], conflicts: { hasHardConflict: true, hasSoftConflict: false, softConflicts: [], unavailabilityConflicts: [], hardConflicts: [] } },
        });
      },
    });
    await user.click(await screen.findByRole('button', { name: 'Asignar' }));
    await user.click(await screen.findByRole('button', { name: /Solo días libres/ }));
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ coverage: 'single', dates: ['2026-10-13'], conflictPolicy: 'reject' }));
  });

  it('shows other rejections inline and stays open', async () => {
    const slots = [{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }];
    const { onClose, user } = setup({
      slots,
      run: () => Promise.resolve({ ok: false, code: 'invalid_role', message: 'El rol no es un rol válido. Elige uno de la lista.', stale: false, retryable: false, conflict: null, result: null }),
    });
    await user.click(await screen.findByRole('button', { name: 'Asignar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El rol no es un rol válido');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers nothing while the state cannot be loaded, only a retry', async () => {
    setup({ state: new Error('boom') });
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el estado');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
  });

  it('refuses a technician in the fridge', () => {
    setup({ fridge: true });
    expect(screen.getByText(/En la nevera/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Asignar' })).not.toBeInTheDocument();
  });

  it('adds a day to a job the technician is already on', async () => {
    const { run, user } = setup({ state: makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13'], state_token: 'tok' }) });
    const save = await screen.findByRole('button', { name: 'Añadir este día' });
    expect(screen.getByText(/Ya está en este trabajo: /)).toBeInTheDocument();
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ coverage: 'full', mode: 'replace' }));
  });

  it('hands staffing requests to the staffing flow and closes', async () => {
    const { openStaffing, onClose, user } = setup();
    await user.click(await screen.findByRole('button', { name: /Pedir disponibilidad u oferta/ }));
    expect(onClose).toHaveBeenCalled();
    expect(openStaffing).toHaveBeenCalledWith(TECH_1, expect.any(Date));
  });

  it('marks the day unavailable and closes', async () => {
    mocks.markUnavailable.mockResolvedValue({ ok: true });
    const { onClose, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar no disponible' }));
    expect(mocks.markUnavailable).toHaveBeenCalledWith(TECH_1, DATE_KEY);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('keeps the inspector open and says why when marking fails', async () => {
    mocks.markUnavailable.mockResolvedValue({ ok: false, message: 'No se pudo marcar como no disponible. Inténtalo de nuevo.' });
    const { onClose, user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Marcar no disponible' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo marcar');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is read-only for someone who cannot assign', () => {
    setup({ canAssign: false });
    expect(screen.getByText(/Solo los responsables pueden asignar/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('assigned cell', () => {
  it('confirms in one click and offers the undo', async () => {
    const { run, onClose, user } = setup({ assignment: assignedRow, state: assignedState });
    await user.click(await screen.findByRole('button', { name: /Confirmar/ }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'confirm', jobId: JOB_A, source: 'matrix-inspector' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.showUndoToast).toHaveBeenCalled();
  });

  it('declining asks inside the inspector first', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState, run: () => Promise.resolve(okOutcome({ undo: null })) });
    await user.click(await screen.findByRole('button', { name: /Rechazar/ }));
    expect(run).not.toHaveBeenCalled();
    const confirm = screen.getByRole('alertdialog');
    expect(confirm).toHaveTextContent('¿Rechazar en nombre de Marta?');
    await user.click(within(confirm).getByRole('button', { name: 'Rechazar' }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'decline' }));
    expect(mocks.showUndoToast).not.toHaveBeenCalled();
  });

  it('changes the role at once', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState });
    await user.click(await screen.findByRole('radio', { name: /FOH — Especialista/ }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'role', department: 'sound', role: 'SND-FOH-E' }));
  });

  it('edits the days and saves them as one replace', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState });
    const strip = await screen.findByRole('group', { name: /Días/ });
    await user.click(within(strip).getByRole('button', { name: /13/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar días' }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'assign', role: 'SND-PA-T', status: 'invited', coverage: 'single', dates: ['2026-10-14'], mode: 'replace',
    }));
  });

  it('removing one day or the whole job needs an inline confirmation', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState });
    await user.click(await screen.findByRole('button', { name: /Quitar este día/ }));
    expect(run).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar este día' }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'remove-date', date: DATE_KEY }));
  });

  it('removes the whole assignment after confirming', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState });
    await user.click(await screen.findByRole('button', { name: /Quitar del trabajo/ }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar 2 días' }));
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'remove' }));
  });

  it('does not offer to remove a day when it is the last one', async () => {
    setup({ assignment: assignedRow, state: makeState({ ...assignedState, dates: [DATE_KEY] }) });
    await screen.findByRole('button', { name: /Quitar del trabajo/ });
    expect(screen.queryByRole('button', { name: /Quitar este día/ })).not.toBeInTheDocument();
  });

  it('moves to another job through the same form', async () => {
    const { run, user } = setup({ assignment: assignedRow, state: assignedState, jobs: [makeJob(JOB_A), makeJob(JOB_B, { title: 'Otro' })] });
    await user.click(await screen.findByRole('button', { name: /Mover a…/ }));
    // The source job is not a destination.
    expect(screen.queryByRole('radio', { name: /Trabajo job-a/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('radio', { name: /Otro/ }));
    const move = await screen.findByRole('button', { name: 'Mover aquí' });
    await waitFor(() => expect(move).toBeEnabled());
    await user.click(move);
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ kind: 'assign', jobId: JOB_B, fromJobId: JOB_A, role: 'SND-PA-T' }));
  });

  it('shows who assigned it and when', async () => {
    setup({ assignment: assignedRow, state: assignedState });
    expect(await screen.findByText(/Asignado por Ana Villar/)).toBeInTheDocument();
  });

  it('shows a rejection from a command inline', async () => {
    const { user } = setup({
      assignment: assignedRow, state: assignedState,
      run: () => Promise.resolve({ ok: false, code: 'approved_timesheet', message: 'Hay partes aprobados en esos días.', stale: false, retryable: false, conflict: null, result: null }),
    });
    await user.click(await screen.findByRole('button', { name: /Quitar este día/ }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Quitar este día' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Hay partes aprobados');
  });

  it('is read-only for someone who cannot assign', async () => {
    setup({ assignment: assignedRow, state: assignedState, canAssign: false });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Asignado por Ana Villar · ', { exact: false })).toBeInTheDocument();
  });
});

describe('unavailable cell', () => {
  it('lifts the mark and closes', async () => {
    mocks.clearUnavailable.mockResolvedValue({ ok: true });
    const { onClose, user } = setup({ availability: { status: 'unavailable', reason: 'Médico' } });
    expect(screen.getByText('No disponible · Médico')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar no disponibilidad' }));
    expect(mocks.clearUnavailable).toHaveBeenCalledWith(TECH_1, DATE_KEY);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('explains when the unavailability comes from somewhere else', async () => {
    mocks.clearUnavailable.mockResolvedValue({ ok: false, message: 'Esta no disponibilidad viene de unas vacaciones o del calendario de temporada: no se puede quitar desde aquí.' });
    const { onClose, user } = setup({ availability: { status: 'unavailable', reason: 'Vacaciones' } });
    await user.click(screen.getByRole('button', { name: 'Quitar no disponibilidad' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('vacaciones o del calendario de temporada');
    expect(onClose).not.toHaveBeenCalled();
  });
});
