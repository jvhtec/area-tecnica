// @vitest-environment jsdom
import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InspectorEnvironment, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import { CellInspectorBody } from '@/features/matrix-v2/inspector/CellInspectorBody';
import { useStaffingComposer } from '@/features/matrix-v2/staffing/useStaffingComposer';
import { makeJob, makeMatrixRow } from '@/features/matrix-v2/__tests__/fixtures';

vi.mock('@/features/staffing/hooks/useStaffing', () => ({ ConflictError: class extends Error {} }));
const technician: InspectorTechnician = { id: 'tech-1', first_name: 'Ana', last_name: 'Test', department: 'sound', skills: [] };
const draft = { jobId: 'job-a', phase: 'offer' as const, days: ['2026-10-14'], channel: 'whatsapp' as const, department: null, message: 'Carga por B' };
const target = { technicianId: technician.id, date: new Date('2026-10-14T12:00:00+02:00'), dateKey: '2026-10-14', anchor: null, staffingDraft: draft };

function environment(assigned = false) {
  const job = makeJob('job-a', { description: 'Nueva descripción', end_time: '2026-10-15T20:00:00+02:00' });
  const other = makeJob('job-b');
  const send = vi.fn(async () => ({ channel: 'whatsapp' }));
  const setChannel = vi.fn();
  const env: InspectorEnvironment = {
    runner: { run: vi.fn(), loadState: vi.fn(), releaseAll: vi.fn() },
    getTechnician: () => technician, getJob: id => id === job.id ? job : other, getJobsForDate: () => [other],
    getAssignmentForCell: () => assigned ? makeMatrixRow({ job, job_id: job.id }) : undefined,
    getAvailabilityForCell: () => undefined, roleSlotsByJob: new Map(), lastRoleByTechnician: new Map(),
    declinedJobIds: () => new Set(), isFridge: () => false, staffingByDate: () => null, profileNames: new Map(),
    canAssign: true, canMarkUnavailable: true, focusJobId: other.id,
    staffing: { send, cancel: vi.fn(), channel: 'email', setChannel, department: 'sound' },
  };
  return { env, send, setChannel };
}
beforeEach(() => vi.clearAllMocks());

describe('batch staffing draft', () => {
  it('restores the offer context instead of the current focus and usual channel', async () => {
    const { env, send, setChannel } = environment();
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target, onDone: vi.fn() }));
    expect(result.current).toMatchObject({ jobId: 'job-a', phase: 'offer', days: ['2026-10-14'], channel: 'whatsapp', message: 'Carga por B' });
    expect(result.current.jobOptions.map(option => option.job.id)).toContain('job-a');
    expect(setChannel).not.toHaveBeenCalled();
    act(() => result.current.pickRole('SND-PA-T'));
    await act(async () => { await result.current.send(); });
    expect(send).toHaveBeenCalledExactlyOnceWith({
      job_id: 'job-a', profile_id: 'tech-1', phase: 'offer', channel: 'whatsapp', department: null,
      single_day: true, dates: ['2026-10-14'], target_date: '2026-10-14', role: 'SND-PA-T', message: 'Carga por B',
    });
    expect(env.runner.run).not.toHaveBeenCalled();
  });

  it('intersects draft days with the actual job and never defaults an empty intersection to the whole job', async () => {
    const { env, send } = environment();
    const draftTarget = { ...target, staffingDraft: { ...draft, days: ['2026-10-12'] } };
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target: draftTarget, onDone: vi.fn() }));
    act(() => result.current.pickRole('SND-PA-T'));
    expect(result.current.days).toEqual([]);
    expect(result.current.canSend).toBe(false);
    await act(async () => { await result.current.send(); });
    expect(send).not.toHaveBeenCalled();
  });

  it('remembers only an explicit channel edit and sends the edited channel and phase', async () => {
    const { env, send, setChannel } = environment();
    const { result } = renderHook(() => useStaffingComposer({ env, technician, target, onDone: vi.fn() }));
    expect(setChannel).not.toHaveBeenCalled();
    act(() => { result.current.setChannel('email'); result.current.setPhase('availability'); });
    expect(setChannel).toHaveBeenCalledExactlyOnceWith('email');
    await act(async () => { await result.current.send(); });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ phase: 'availability', channel: 'email', department: null, dates: ['2026-10-14'] }));
  });

  it('keeps retained whole-job days explicit and does not grow them when the job grows', async () => {
    const { env, send } = environment();
    const days = ['2026-10-13', '2026-10-14', '2026-10-15'];
    const draftTarget = { ...target, staffingDraft: { ...draft, days } };
    const { result, rerender } = renderHook(({ environment }) => useStaffingComposer({
      env: environment, technician, target: draftTarget, onDone: vi.fn(),
    }), { initialProps: { environment: env } });
    act(() => result.current.pickRole('SND-PA-T'));
    await act(async () => { await result.current.send(); });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ single_day: true, dates: days }));
    rerender({ environment: { ...env, getJob: () => makeJob('job-a', { end_time: '2026-10-16T20:00:00+02:00' }) } });
    expect(result.current.jobDays).toContain('2026-10-16');
    expect(result.current.days).toEqual(days);
  });

  it.each(['missing', 'declined', 'fridge'] as const)('does not send a retained request when the job/person becomes %s', async state => {
    const { env, send } = environment();
    const guarded: InspectorEnvironment = {
      ...env,
      ...(state === 'missing' ? { getJob: () => undefined } : {}),
      ...(state === 'declined' ? { declinedJobIds: () => new Set(['job-a']) } : {}),
      ...(state === 'fridge' ? { isFridge: () => true } : {}),
    };
    const { result } = renderHook(() => useStaffingComposer({ env: guarded, technician, target, onDone: vi.fn() }));
    act(() => result.current.pickRole('SND-PA-T'));
    expect(result.current.jobId).toBe('job-a');
    expect(result.current.canSend).toBe(false);
    await act(async () => { await result.current.send(); });
    expect(send).not.toHaveBeenCalled();
  });

  it('starts a new draft on the same cell with its own phase and channel', () => {
    const { env } = environment();
    const { rerender } = render(<CellInspectorBody env={env} target={target} onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Oferta' })).toBeChecked();
    rerender(<CellInspectorBody env={env} target={{ ...target, staffingDraft: { ...draft, phase: 'availability', channel: 'email' } }} onClose={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Disponibilidad' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Email' })).toBeChecked();
  });

  it.each([false, true])('opens directly on the staffing form and sends no assignment command (assigned=%s)', async assigned => {
    const { env, send } = environment(assigned);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CellInspectorBody env={env} target={target} onClose={vi.fn()} />
    </QueryClientProvider>);
    expect(screen.getByRole('radio', { name: 'Oferta' })).toBeChecked();
    expect(screen.queryByRole('button', { name: /^Asignar/ })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ver los 9 roles' }));
    await user.click(screen.getByRole('radio', { name: /Tecnico de Escenario — Técnico/ }));
    await user.click(screen.getByRole('button', { name: 'Enviar oferta (1 día)' }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ job_id: 'job-a', phase: 'offer', role: 'SND-PA-T', dates: ['2026-10-14'] }));
    expect(env.runner.run).not.toHaveBeenCalled();
  });
});
