// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn(), success: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: mocks.toast, Toaster: (): null => null }));
vi.mock('@/features/matrix-v2/undoToast', () => ({ showUndoToast: vi.fn() }));
vi.mock('@/features/assignments/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/assignments/commands')>()),
  getAssignmentCommandState: mocks.getState,
}));

import type { MatrixStaffingStatus } from '@/components/matrix/optimized-matrix-cell/types';
import { CellInspectorBody } from '@/features/matrix-v2/inspector/CellInspectorBody';
import type { InspectorEnvironment, InspectorTarget, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import { buildJobRoleSlots } from '@/features/matrix-v2/roleSlots';
import type { StaffingSendPayload } from '@/features/matrix-v2/staffing/payload';
import { ConflictError } from '@/features/staffing/hooks/useStaffing';
import { useStaffingComposer, type StaffingComposer } from '@/features/matrix-v2/staffing/useStaffingComposer';
import { JOB_A, JOB_B, TECH_1, makeJob, makeState } from '@/features/matrix-v2/__tests__/fixtures';

const technician: InspectorTechnician = {
  id: TECH_1, first_name: 'Marta', last_name: 'Ibáñez', nickname: null, department: 'sound',
  skills: [{ name: 'Monitores', is_primary: true }],
};
const DATE_KEY = '2026-10-14';
const target = (): InspectorTarget => ({ technicianId: TECH_1, date: new Date('2026-10-13T22:00:00Z'), dateKey: DATE_KEY, anchor: null });

interface Setup {
  jobs?: ReturnType<typeof makeJob>[];
  status?: MatrixStaffingStatus | null;
  declined?: string[];
  send?: (payload: StaffingSendPayload) => Promise<{ channel?: string | null } | undefined>;
  channel?: 'email' | 'whatsapp';
  focusJobId?: string;
}

function composerEnvironment(options: Setup = {}) {
  const jobs = options.jobs ?? [makeJob(JOB_A, { description: 'Carga a las 8 en la puerta B' })];
  const send = vi.fn(options.send ?? ((payload: StaffingSendPayload) => Promise.resolve({ channel: payload.channel })));
  const cancel = vi.fn(() => Promise.resolve());
  const setChannel = vi.fn();
  const onClose = vi.fn();
  mocks.getState.mockResolvedValue(makeState());
  const env: InspectorEnvironment = {
    runner: { run: vi.fn(), releaseAll: vi.fn(), loadState: vi.fn() },
    getTechnician: (id) => (id === TECH_1 ? technician : undefined),
    getJob: (id) => jobs.find((job) => job.id === id),
    getJobsForDate: () => jobs,
    getAssignmentForCell: () => undefined,
    getAvailabilityForCell: () => undefined,
    roleSlotsByJob: buildJobRoleSlots([{ job_id: JOB_A, department: 'sound', roles: [{ role_code: 'SND-MON-E', quantity: 1 }] }], []),
    lastRoleByTechnician: new Map(),
    declinedJobIds: () => new Set(options.declined ?? []),
    isFridge: () => false,
    staffingByDate: () => options.status ?? null,
    profileNames: new Map(),
    canAssign: true,
    canMarkUnavailable: true,
    focusJobId: options.focusJobId,
    staffing: { send, cancel, channel: options.channel ?? 'email', setChannel, department: 'sound' },
  };
  return { env, send, cancel, setChannel, onClose };
}

async function openComposer(options: Setup = {}) {
  const { env, send, cancel, setChannel, onClose } = composerEnvironment(options);
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CellInspectorBody env={env} target={target()} onClose={onClose} />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole('button', { name: /Pedir disponibilidad u oferta/ }));
  return { send, cancel, setChannel, onClose, user };
}

beforeEach(() => vi.clearAllMocks());

describe('availability', () => {
  it('asks for the whole job with the only job preselected, on the usual channel', async () => {
    const { send, onClose, user } = await openComposer();
    expect(screen.getByRole('radio', { name: 'Disponibilidad' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Trabajo job-a/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    expect(send).toHaveBeenCalledWith({
      job_id: JOB_A, profile_id: TECH_1, phase: 'availability', channel: 'email', department: 'sound', single_day: false,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.toast.success).toHaveBeenCalledWith('Disponibilidad pedida a Marta Ibáñez por Email');
  });

  it('asks for the days that are picked, saying how many in the button', async () => {
    const { send, user } = await openComposer();
    await user.click(screen.getByRole('button', { name: 'Solo este día' }));
    await user.click(await screen.findByRole('button', { name: 'Pedir disponibilidad (1 día)' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ single_day: true, dates: ['2026-10-14'], target_date: '2026-10-14' }));
  });

  it('uses the channel from the environment, and a change is handed back to be remembered', async () => {
    const { send, setChannel, user } = await openComposer({ channel: 'whatsapp' });
    expect(screen.getByRole('radio', { name: 'WhatsApp' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Email' }));
    expect(setChannel).toHaveBeenCalledWith('email');
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ channel: 'whatsapp' }));
  });

  it('will not send for a job the person already declined', async () => {
    await openComposer({ declined: [JOB_A] });
    expect(screen.getByRole('radio', { name: /Trabajo job-a/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pedir disponibilidad' })).toBeDisabled();
  });
});

describe('offer', () => {
  it('suggests the role from the open slot, includes the job description as a collapsed message, and sends', async () => {
    const { send, user } = await openComposer();
    await user.click(screen.getByRole('radio', { name: 'Oferta' }));
    expect(screen.getByRole('radio', { name: /Monitores — Especialista, sugerido/ })).toBeChecked();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incluye la descripción del trabajo/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enviar oferta' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'offer', role: 'SND-MON-E', message: 'Carga a las 8 en la puerta B', single_day: false, channel: 'email',
    }));
  });

  it('sends an edited message', async () => {
    const { send, user } = await openComposer();
    await user.click(screen.getByRole('radio', { name: 'Oferta' }));
    await user.click(screen.getByRole('button', { name: /Editar mensaje/ }));
    const box = screen.getByRole('textbox');
    await user.clear(box);
    await user.type(box, 'Nos vemos en el muelle');
    await user.click(screen.getByRole('button', { name: 'Enviar oferta' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Nos vemos en el muelle' }));
  });

  it('opens on the offer for the job that said yes', async () => {
    await openComposer({
      jobs: [makeJob(JOB_A), makeJob(JOB_B)],
      status: { availability_status: 'confirmed', offer_status: null, availability_job_id: JOB_B, availability_job_title: 'Trabajo job-b' },
    });
    expect(screen.getByRole('radio', { name: 'Oferta' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Trabajo job-b/ })).toBeChecked();
  });

  it('opens on the focused job when there are several that day', async () => {
    await openComposer({ jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_B });
    expect(screen.getByRole('radio', { name: /Trabajo job-b/ })).toBeChecked();
  });
});

describe('what is already out', () => {
  const requested: MatrixStaffingStatus = {
    availability_status: 'requested', offer_status: null, availability_request_id: 'req-1',
    availability_job_id: JOB_A, availability_job_title: 'Trabajo job-a', pending_availability_job_ids: [JOB_A, JOB_B],
  };

  it('resends the same request on the selected channel', async () => {
    const { send, user } = await openComposer({ status: requested, channel: 'whatsapp' });
    expect(screen.getByText(/Esperando respuesta/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar por WhatsApp' }));
    expect(send).toHaveBeenCalledWith({
      job_id: JOB_A, profile_id: TECH_1, phase: 'availability', channel: 'whatsapp', department: 'sound', resend_request_id: 'req-1',
    });
    expect(mocks.toast.success).toHaveBeenCalledWith('Solicitud reenviada a Marta Ibáñez por WhatsApp');
  });

  it('cancels every pending request after one inline confirmation', async () => {
    const { cancel, user } = await openComposer({ status: requested });
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    const confirm = screen.getByRole('alertdialog');
    expect(within(confirm).getByText('Se cancelarán 2 solicitudes pendientes en esta fecha.')).toBeInTheDocument();
    expect(cancel).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(2));
    expect(cancel).toHaveBeenCalledWith({ job_id: JOB_A, profile_id: TECH_1, phase: 'availability' });
    expect(cancel).toHaveBeenCalledWith({ job_id: JOB_B, profile_id: TECH_1, phase: 'availability' });
  });

  it('an offer in flight can be cancelled but not resent', async () => {
    await openComposer({ status: { availability_status: 'confirmed', offer_status: 'sent', offer_job_id: JOB_A, offer_job_title: 'Trabajo job-a' } });
    expect(screen.getByRole('button', { name: 'Cancelar oferta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reenviar/ })).not.toBeInTheDocument();
  });
});

describe('when the server objects', () => {
  const conflictError = () => new ConflictError('Conflict', { conflicts: [{ job_name: 'Boda Sol' }] });

  it.each([
    ['job', /Trabajo job-b/],
    ['phase', 'Oferta'],
    ['dates', 'Solo este día'],
    ['channel', 'WhatsApp'],
  ])('clears the rejected request after editing %s and sends without an override', async (field, label) => {
    const send = vi.fn().mockRejectedValueOnce(conflictError()).mockResolvedValue({ channel: 'email' });
    const { user } = await openComposer({ send, jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_A });
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole(field === 'dates' ? 'button' : 'radio', { name: label }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar igualmente' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^(Pedir disponibilidad|Enviar oferta)/ }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).not.toHaveProperty('override_conflicts');
    if (field === 'job') expect(send.mock.calls[1][0].job_id).toBe(JOB_B);
    if (field === 'phase') expect(send.mock.calls[1][0].phase).toBe('offer');
    if (field === 'dates') expect(send.mock.calls[1][0].dates).toEqual([DATE_KEY]);
  });

  const semanticEdits: Array<[string, (composer: StaffingComposer) => void]> = [
    ['job', (composer) => composer.pickJob(JOB_B)],
    ['phase', (composer) => composer.setPhase('availability')],
    ['dates', (composer) => composer.selectThisDayOnly()],
    ['toggle day', (composer) => composer.toggleDay(DATE_KEY)],
    ['all days', (composer) => composer.selectAllDays()],
    ['role', (composer) => composer.pickRole('SND-FOH-E')],
    ['channel', (composer) => composer.setChannel('whatsapp')],
    ['message', (composer) => composer.setMessage('Nos vemos en el muelle')],
  ];

  it.each(semanticEdits)('clears conflict and refuses a forced send after editing %s', async (_field, edit) => {
    const { env, send, onClose } = composerEnvironment({
      jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_A,
      send: () => Promise.reject(conflictError()),
    });
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: target(), onDone: onClose }));
    act(() => result.current.setPhase('offer'));
    await act(() => result.current.send());
    expect(result.current.conflict).not.toBeNull();
    act(() => edit(result.current));
    expect(result.current.conflict).toBeNull();
    await act(() => result.current.send(true));
    expect(send).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(semanticEdits)('clears a send error after editing %s', async (_field, edit) => {
    const { env, onClose } = composerEnvironment({
      jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_A,
      send: () => Promise.reject(new Error('No se pudo enviar')),
    });
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: target(), onDone: onClose }));
    act(() => result.current.setPhase('offer'));
    await act(() => result.current.send());
    expect(result.current.error).toBe('No se pudo enviar');
    act(() => edit(result.current));
    expect(result.current.error).toBeNull();
  });

  it('refuses a forced send without a server rejection', async () => {
    const { env, send, onClose } = composerEnvironment();
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: target(), onDone: onClose }));
    await act(() => result.current.send(true));
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a stale override callback after the selected job changes', async () => {
    const { env, send, onClose } = composerEnvironment({
      jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_A, send: () => Promise.reject(conflictError()),
    });
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: target(), onDone: onClose }));
    await act(() => result.current.send());
    const staleSend = result.current.send;
    act(() => result.current.pickJob(JOB_B));
    await act(() => staleSend(true));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(['channel', 'department', 'job dates'] as const)('invalidates the rejected decision when %s changes in the environment', async (field) => {
    const { env, send, onClose } = composerEnvironment({ send: () => Promise.reject(conflictError()) });
    const { result, rerender } = renderHook(({ environment }) => useStaffingComposer({
      env: environment, technician, target: target(), onDone: onClose,
    }), { initialProps: { environment: env } });
    await act(() => result.current.send());
    expect(result.current.conflict).not.toBeNull();
    const environment: InspectorEnvironment = field === 'job dates'
      ? { ...env, getJobsForDate: () => [makeJob(JOB_A, { end_time: '2026-10-15T20:00:00+02:00' })] }
      : { ...env, staffing: { ...env.staffing, ...(field === 'channel' ? { channel: 'whatsapp' as const } : { department: 'lights' }) } };
    rerender({ environment });
    expect(result.current.conflict).toBeNull();
    await act(() => result.current.send(true));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not restore a late conflict after the decision was edited', async () => {
    let rejectRequest!: (cause: unknown) => void;
    const { env, send, onClose } = composerEnvironment({
      jobs: [makeJob(JOB_A), makeJob(JOB_B)], focusJobId: JOB_A,
      send: () => new Promise((_resolve, reject) => { rejectRequest = reject; }),
    });
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: target(), onDone: onClose }));
    let request!: Promise<void>;
    act(() => { request = result.current.send(); });
    act(() => result.current.pickJob(JOB_B));
    await act(async () => { rejectRequest(conflictError()); await request; });
    expect(result.current.busy).toBe(false);
    expect(result.current.conflict).toBeNull();
    await act(() => result.current.send(true));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows the clash inline and "Enviar igualmente" sends again accepting it', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new ConflictError('Conflict', { conflicts: [{ job_name: 'Boda Sol', start_time: '2026-10-13T08:00:00Z', end_time: '2026-10-14T18:00:00Z' }], unavailability: [{ date: '2026-10-15', reason: 'Vacaciones' }] }))
      .mockResolvedValueOnce({ channel: 'email' });
    const { user, onClose } = await openComposer({ send });
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se ha enviado: hay un choque de agenda');
    expect(alert).toHaveTextContent('Boda Sol');
    expect(alert).toHaveTextContent('Vacaciones');
    expect(screen.queryByRole('button', { name: 'Pedir disponibilidad' })).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Enviar igualmente' }));
    expect(send).toHaveBeenLastCalledWith({ ...send.mock.calls[0][0], override_conflicts: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows any other failure and keeps the form for another try', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('El proveedor de WhatsApp no responde')).mockResolvedValueOnce({ channel: 'email' });
    const { user, onClose } = await openComposer({ send });
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El proveedor de WhatsApp no responde');
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Pedir disponibilidad' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
