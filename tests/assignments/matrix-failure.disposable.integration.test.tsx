// @vitest-environment jsdom
import React from 'react';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { disposableCampaignHarness } from './helpers/disposableCampaignHarness';
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
import { fromMadridDateKey } from '@/utils/timezoneUtils';
import { toggleTimesheetDay } from '@/services/toggleTimesheetDay';

describe.skipIf(!process.env.STAFFING_DISPOSABLE_MANIFEST && !process.env.STAFFING_CI_MANIFEST)('disposable clone real matrix partial-write evidence (P0.16)', () => {
  let h: ReturnType<typeof disposableCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let historicalBaseline: string[];
  let background: ReturnType<typeof trackLocalFunctions> | undefined;
  let queryClient: QueryClient | undefined;
  let cleanupUnsafe = false;

  beforeAll(async () => {
    h = disposableCampaignHarness(['manage-flex-crew-assignments/index.ts']);
    await h.prepare();
    baseline = h.fingerprint(); historicalBaseline = h.historicalFingerprint();
    manager = await h.user('management');
    tech = await h.user();
  }, 90_000);
  beforeEach(() => {
    if (cleanupUnsafe) throw new Error('Local transport failure requires runtime quiescence before further fixtures');
    h?.assertFixtureSafe();
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
    catch (error) {
      cleanupUnsafe = !h?.cleanupSafe || background?.transportComplete === false;
      throw error;
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
    for (const action of [h.cleanJobs, h.cleanUsers, h.finish]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); expect(h.historicalFingerprint()).toEqual(historicalBaseline); } catch (error) { failures.push(error); }
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

  it('same manager without fault creates both sparse dates and emits success', async () => {
    const item = await job();
    const event = vi.fn(); window.addEventListener('assignment-updated', event);
    try {
      const ui = await mount(item); await multi(ui);
      await ui.user.click(screen.getByRole('gridcell', { name: '22' }));
      await submit(ui);
      expect(await dates(item.id)).toEqual(['2027-10-20','2027-10-22']);
      expect(await assignment(item.id)).toMatchObject({ single_day: true, assignment_date: '2027-10-20',
        status: 'invited', assignment_source: 'direct', sound_role: 'SND-FOH-R', assigned_by: manager.id });
      expect(toast.error).not.toHaveBeenCalled(); expect(toast.success).toHaveBeenCalledOnce();
      expect(event).toHaveBeenCalledOnce();
      expect(background!.calls.filter(call => call.name === 'manage-flex-crew-assignments')).toHaveLength(1);
    } finally { window.removeEventListener('assignment-updated', event); }
  }, 45_000);

  it('one failed RPC retains membership and only the successful selected date, leaving the dialog open', async () => {
    const item = await job();
    await h.armFault(item.id,tech.id,manager.id,'2027-10-22');
    const event = vi.fn(); window.addEventListener('assignment-updated', event);
    const rpc = vi.spyOn(manager.client,'rpc');
    try {
      const ui = await mount(item); await multi(ui);
      await ui.user.click(screen.getByRole('gridcell', { name: '22' }));
      await ui.user.click(screen.getByRole('button', { name: /^Asignar trabajo$/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
        'Error al asignar el trabajo: Error al crear hojas de hora para las fechas: 2027-10-22'), { timeout: 15_000 });
      await waitFor(() => expect(screen.getByRole('button', { name: /^Asignar trabajo$/ })).toBeEnabled());
      await background!.drain();
      // A normal dialog close is delayed by 100ms. Keep all observers and the
      // real component mounted past that window before claiming absence.
      await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 175)); });
      await background!.drain();
      expect(rpc.mock.calls.filter(([name]) => name==='toggle_timesheet_day').map(([,args]) => args?.p_date).sort())
        .toEqual(['2027-10-20','2027-10-22']);
      const trace = h.transportEvents.filter(event => event.jobId === item.id);
      const committedMembership = trace.findIndex(event => event.kind==='complete' && event.path==='/rest/v1/job_assignments' && event.status===201);
      const dispatchedDates = trace.map((event,index)=>({event,index})).filter(({event}) => event.kind==='dispatch' && event.path==='/rest/v1/rpc/toggle_timesheet_day');
      const firstCompletedDate = trace.findIndex(event => event.kind==='complete' && event.path==='/rest/v1/rpc/toggle_timesheet_day');
      expect(committedMembership).toBeGreaterThanOrEqual(0);
      expect(dispatchedDates).toHaveLength(2);
      expect(dispatchedDates.map(({event})=>event.date).sort()).toEqual(['2027-10-20','2027-10-22']);
      expect(committedMembership).toBeLessThan(dispatchedDates[0].index);
      expect(dispatchedDates[1].index).toBeLessThan(firstCompletedDate);
      const completed = await Promise.all(rpc.mock.results.filter(result=>result.type==='return').map(result=>result.value));
      const rejected = completed.filter(result=>result.error);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].error).toMatchObject({ code:'P0001',message:'LOCAL_MATRIX_OWNED_DATE_FAILURE' });
      expect(await dates(item.id)).toEqual(['2027-10-20']);
      expect(await assignment(item.id)).toMatchObject({ single_day:true,assignment_date:'2027-10-20',status:'invited',
        assignment_source:'direct',sound_role:'SND-FOH-R',assigned_by:manager.id });
      expect(ui.close).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled(); expect(event).not.toHaveBeenCalled();
      expect(background!.calls).toEqual([]);
    } finally { rpc.mockRestore(); window.removeEventListener('assignment-updated',event); }
  }, 45_000);

  it('the unchanged date RPC still rejects a technician with exact authorization denial', async () => {
    const item=await job(); bind(tech.client);
    await expect(toggleTimesheetDay({ jobId:item.id,technicianId:tech.id,dateIso:'2027-10-20',present:true }))
      .rejects.toMatchObject({code:'42501'});
    expect(await dates(item.id)).toEqual([]);
    const membership=await h.client.from('job_assignments').select('job_id').eq('job_id',item.id).eq('technician_id',tech.id);
    expect(membership.error).toBeNull(); expect(membership.data).toEqual([]);
  }, 45_000);
});
