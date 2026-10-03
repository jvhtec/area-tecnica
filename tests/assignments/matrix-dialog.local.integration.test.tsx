// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import { trackLocalFunctions } from './helpers/trackLocalFunctions';
import { navigateCalendarMonth } from './helpers/navigateCalendarMonth';

const binding = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
// The legacy dataLayerClient captures this export during module initialization.
// Forward its properties to the same real signed-in client as the services.
vi.mock('@/lib/supabase', () => ({ supabase: new Proxy({}, {
  get(_target, property) {
    const value = Reflect.get(binding.client, property);
    return typeof value === 'function' ? value.bind(binding.client) : value;
  },
}) }));
vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return binding.client; } }));
import { AssignJobDialog, type AssignableJob, type ExistingAssignment } from '@/components/matrix/AssignJobDialog';
import { useMatrixCellAssignmentRemoval } from '@/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval';
import { fromMadridDateKey } from '@/utils/timezoneUtils';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';

describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('real matrix dialog persistence on local Auth/RLS/SQL (P0.14/15/17)', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let background: ReturnType<typeof trackLocalFunctions> | undefined;
  let queryClient: QueryClient | undefined;
  let cleanupUnsafe = false;

  beforeAll(async () => {
    h = localCampaignHarness(['manage-flex-crew-assignments/index.ts']);
    await h.prepare();
    baseline = h.fingerprint();
    manager = await h.user('management');
    tech = await h.user();
  }, 90_000);
  beforeEach(() => {
    if (cleanupUnsafe) throw new Error('Local transport failure requires runtime quiescence before further fixtures');
    h?.assertCleanupSafe();
  });
  afterEach(async () => {
    if (cleanupUnsafe) return;
    cleanupUnsafe = true;
    try {
      cleanup(); queryClient?.clear();
      await background?.drain();
      await h?.cleanJobs();
      cleanupUnsafe = false;
    }
    finally {
      cleanup();
      queryClient?.clear();
      background?.restore();
      background = undefined;
    }
  }, 100_000);
  afterAll(async () => {
    if (!h) return;
    if (cleanupUnsafe) throw new Error('Owned fixtures retained: local function transport needs quiescence before cleanup');
    const failures: unknown[] = [];
    for (const action of [h.cleanJobs, h.cleanUsers]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Local matrix fixture cleanup or preservation failed');
  }, 200_000);

  function bind(client = manager.client) {
    binding.client = client;
    background = trackLocalFunctions(client);
  }

  async function job(): Promise<AssignableJob> {
    const id = await h.job();
    // UTC begins on the previous day, but the intended Madrid span is 20–22.
    const result = await h.client.from('jobs').update({ start_time: '2027-10-19T22:30:00Z',
      end_time: '2027-10-22T21:59:00Z' }).eq('id', id).select('id,title,status,start_time,end_time').single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function assignment(jobId: string) {
    const result = await h.client.from('job_assignments').select('*').eq('job_id', jobId).eq('technician_id', tech.id).single();
    expect(result.error).toBeNull();
    return result.data! as ExistingAssignment;
  }

  async function dates(jobId: string) {
    const result = await h.client.from('timesheets').select('date').eq('job_id', jobId).eq('technician_id', tech.id).eq('is_active', true).order('date');
    expect(result.error).toBeNull();
    return result.data!.map(row => row.date);
  }

  async function mount(item: AssignableJob, date = '2027-10-20', existingAssignment?: ExistingAssignment) {
    bind();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const close = vi.fn();
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><AssignJobDialog open onClose={close} technicianId={tech.id}
      date={fromMadridDateKey(date)} availableJobs={[item]} preSelectedJobId={item.id} existingAssignment={existingAssignment} /></QueryClientProvider>);
    const combo = await screen.findByRole('combobox');
    await user.click(combo);
    await user.click(await screen.findByRole('option', { name: 'FOH — Responsable' }));
    // Active queries must finish before submitting; their real cache supplies
    // modification mode, rather than a manufactured useQuery result.
    await waitFor(() => expect(queryClient!.isFetching()).toBe(0));
    return { user, close, jobId: item.id };
  }

  async function submit(ui: Awaited<ReturnType<typeof mount>>) {
    await ui.user.click(screen.getByRole('button', { name: /^(Asignar|Reasignar) trabajo$/ }));
    await waitFor(() => expect(ui.close).toHaveBeenCalledOnce(), { timeout: 15_000 });
    await background!.drain();
    const pushes = background!.calls.filter(call => call.name === 'push');
    expect(pushes).toHaveLength(1);
    const push = pushes[0];
    expect((await push.result).error).toBeNull();
    expect(push.body).toMatchObject({ action: 'broadcast', type: 'job.assignment.direct', job_id: ui.jobId, recipient_id: tech.id,
      departments: ['sound'] });
  }

  async function multi(ui: Awaited<ReturnType<typeof mount>>) {
    await ui.user.click(screen.getByRole('tab', { name: 'Varios Días' }));
    // This picker opens at today's month. Navigate its actual controls rather
    // than freezing the clock used by real Auth and HTTP timeouts.
    await navigateCalendarMonth(ui.user, new Date(2027, 9, 1));
    expect(screen.getByText('October 2027')).toBeInTheDocument();
  }

  it('full coverage creates every intended Madrid calendar date', async () => {
    const item = await job();
    const ui = await mount(item);
    await submit(ui);
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-21', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: false, assignment_date: null, status: 'invited',
      assignment_source: 'direct', sound_role: 'SND-FOH-R', assigned_by: manager.id });
  }, 45_000);

  it('single-day coverage creates only the selected day', async () => {
    const item = await job();
    const ui = await mount(item, '2027-10-21');
    await ui.user.click(screen.getByRole('tab', { name: 'Día Suelto' }));
    await ui.user.click(screen.getByRole('checkbox', { name: 'Asignar como confirmado (omitir invitación)' }));
    await submit(ui);
    expect(await dates(item.id)).toEqual(['2027-10-21']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-21', status: 'confirmed' });
  }, 45_000);

  it('multiple dates preserve sparse selection including an earlier prep day', async () => {
    const item = await job();
    expect((await h.client.from('job_date_types').insert({ job_id: item.id, date: '2027-10-18', type: 'prep_day' })).error).toBeNull();
    item.job_date_types = [{ date: '2027-10-18', type: 'prep_day' }];
    const ui = await mount(item, '2027-10-22');
    await multi(ui);
    await ui.user.click(screen.getByRole('gridcell', { name: '18' }));
    await submit(ui);
    expect(await dates(item.id)).toEqual(['2027-10-18', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-18' });
  }, 45_000);

  it('adding a day preserves confirmed membership, its anchor and approved work fields', async () => {
    const item = await job();
    bind();
    await h.assignment(item.id, tech.id, 'confirmed', 'SND-FOH-R');
    expect((await h.client.from('job_assignments').update({ single_day: true, assignment_date: '2027-10-20',
      response_time: '2026-10-01T08:00:00Z' }).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    await toggleTimesheetDay({ jobId: item.id, technicianId: tech.id, dateIso: '2027-10-20', present: true });
    expect((await h.client.from('timesheets').update({ status: 'submitted' }).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    const approved = { status: 'approved', approved_by_manager: true, approved_by: manager.id, approved_at: '2026-10-01T09:00:00Z',
      start_time: '08:00:00', end_time: '18:00:00', break_minutes: 60, signature_data: 'local-test-signature', notes: 'Local approved work' };
    expect((await h.client.from('timesheets').update(approved).eq('job_id', item.id).eq('technician_id', tech.id)).error).toBeNull();
    const retainedFields = 'id,status,approved_by_manager,approved_by,approved_at,start_time,end_time,break_minutes,signature_data,notes';
    const before = await h.client.from('timesheets').select(retainedFields).eq('job_id', item.id).eq('technician_id', tech.id).eq('date', '2027-10-20').single();
    expect(before.error).toBeNull();
    expect(before.data).toMatchObject({ status: 'approved', approved_by_manager: true });
    background!.restore();
    const ui = await mount(item, '2027-10-22');
    await ui.user.click(screen.getByRole('tab', { name: 'Día Suelto' }));
    await ui.user.click(await screen.findByRole('button', { name: 'Añadir Fechas' }));
    await submit(ui);
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-20', status: 'confirmed',
      response_time: '2026-10-01T08:00:00+00:00' });
    const retained = await h.client.from('timesheets').select(retainedFields).eq('job_id', item.id).eq('technician_id', tech.id).eq('date', '2027-10-20').single();
    expect(retained.error).toBeNull();
    expect(retained.data).toEqual(before.data);
  }, 45_000);

  it('replacing dates removes the old schedule and updates the scoped anchor', async () => {
    const item = await job();
    const initial = await mount(item);
    await submit(initial);
    cleanup(); queryClient!.clear(); background!.restore();
    const ui = await mount(item, '2027-10-22', await assignment(item.id));
    await ui.user.click(screen.getByRole('tab', { name: 'Día Suelto' }));
    await ui.user.click(await screen.findByRole('button', { name: 'Reemplazar Fechas' }));
    await submit(ui);
    expect(await dates(item.id)).toEqual(['2027-10-22']);
    expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-22' });
  }, 45_000);

  it('single-date cell removal retains the base assignment and the other schedule', async () => {
    const item = await job();
    const ui = await mount(item);
    await submit(ui);
    cleanup(); queryClient!.clear();
    const saved = await assignment(item.id);
    const hook = renderHook(() => useMatrixCellAssignmentRemoval({ assignment: saved,
      technician: { id: tech.id, department: 'sound' }, date: fromMadridDateKey('2027-10-21') }));
    await act(async () => { await hook.result.current.checkMultiDateAssignment(); });
    expect(hook.result.current.multiDateRemoval.otherDatesCount).toBe(2);
    await act(async () => { await hook.result.current.handleRemoveAssignment(false); });
    expect(await dates(item.id)).toEqual(['2027-10-20', '2027-10-22']);
    expect(await assignment(item.id)).toEqual(saved);
  }, 45_000);

  it('the real date RPC rejects a technician caller', async () => {
    const item = await job();
    bind(tech.client);
    await expect(toggleTimesheetDay({ jobId: item.id, technicianId: tech.id, dateIso: '2027-10-20', present: true }))
      .rejects.toMatchObject({ code: '42501' });
    expect(await dates(item.id)).toEqual([]);
  }, 45_000);

  it('removing the last cell date deletes membership through the lifecycle RPC', async () => {
    const item = await job();
    const ui = await mount(item, '2027-10-21');
    await ui.user.click(screen.getByRole('tab', { name: 'Día Suelto' }));
    await submit(ui);
    cleanup(); queryClient!.clear();
    const saved = await assignment(item.id);
    const hook = renderHook(() => useMatrixCellAssignmentRemoval({ assignment: saved,
      technician: { id: tech.id, department: 'sound' }, date: fromMadridDateKey('2027-10-21') }));
    await act(async () => { await hook.result.current.checkMultiDateAssignment(); });
    expect(hook.result.current.multiDateRemoval.otherDatesCount).toBe(0);
    await act(async () => { await hook.result.current.handleRemoveAssignment(false); });
    await background!.drain();
    expect(await dates(item.id)).toEqual([]);
    const remaining = await h.client.from('job_assignments').select('job_id').eq('job_id', item.id).eq('technician_id', tech.id);
    expect(remaining.error).toBeNull();
    expect(remaining.data).toEqual([]);
    const removal = background!.calls.filter(call => call.name === 'push').at(-1)!;
    expect((await removal.result).error).toBeNull();
    expect(removal.body).toMatchObject({ action: 'broadcast', type: 'assignment.removed',
      job_id: item.id, recipient_id: tech.id, technician_id: tech.id });
  }, 45_000);
});
