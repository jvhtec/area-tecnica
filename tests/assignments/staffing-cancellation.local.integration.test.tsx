// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';
import { trackLocalFunctions } from './helpers/trackLocalFunctions';

const binding = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }));
// Replace only the configured client binding with the real local Auth client.
// The hook, QueryClient, SDK transport, RLS, SQL and Edge Functions stay real.
vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return binding.client; } }));
import { useCancelStaffingRequest, useStaffingStatus } from '@/features/staffing/hooks/useStaffing';
import { queryKeys } from '@/lib/react-query';

describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('real manager cancellation hook on isolated local Auth/RLS/Edge Runtime (P0.13)', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let manager: Awaited<ReturnType<typeof h.user>>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let other: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let background: ReturnType<typeof trackLocalFunctions> | undefined;
  let queryClient: QueryClient | undefined;
  let cleanupUnsafe = false;

  beforeAll(async () => {
    h = localCampaignHarness();
    await h.prepare();
    baseline = h.fingerprint();
    manager = await h.user('management');
    tech = await h.user();
    other = await h.user();
  }, 90_000);
  beforeEach(() => {
    if (cleanupUnsafe) throw new Error('Local transport failure requires runtime quiescence before further fixtures');
    h?.assertFixtureSafe();
  });
  afterEach(async () => {
    if (cleanupUnsafe) return;
    // Set this before waiting: a Vitest hook timeout need not reject drain().
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
    for (const action of [h.cleanJobs, h.cleanUsers]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { if (baseline) expect(h.fingerprint()).toEqual(baseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Local cancellation fixture cleanup or preservation failed');
  }, 200_000);

  function mount(client = manager.client, observedJobId = '') {
    binding.client = client;
    background = trackLocalFunctions(client);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient!}>{children}</QueryClientProvider>;
    return renderHook(() => {
      useStaffingStatus(observedJobId, tech.id);
      return useCancelStaffingRequest();
    }, { wrapper });
  }

  async function cancel(hook: ReturnType<typeof mount>, jobId: string, phase: 'availability' | 'offer') {
    let value: unknown;
    await act(async () => { value = await hook.result.current.mutateAsync({ job_id: jobId, profile_id: tech.id, phase }); });
    await background!.drain();
    return value;
  }

  async function row(id: string) {
    const result = await h.client.from('staffing_requests').select('status,updated_at').eq('id', id).single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  it.each(['availability', 'offer'] as const)('expires every non-expired %s date and preserves other tuple members', async phase => {
    const job = await h.job();
    const otherJob = await h.job();
    const target = [];
    for (const [index, status] of ['pending', 'confirmed', 'declined', 'expired'].entries()) {
      target.push(await h.request(job, tech.id, phase, status, 'SND-FOH-T', `2027-10-${20 + index}`));
    }
    const alreadyExpired = await row(target[3]);
    const differentPhase = await h.request(job, tech.id, phase === 'offer' ? 'availability' : 'offer', 'pending');
    const differentProfile = await h.request(job, other.id, phase, 'confirmed');
    const differentJob = await h.request(otherJob, tech.id, phase, 'declined');
    const hook = mount();
    expect(await cancel(hook, job, phase)).toEqual({ success: true, rowsAffected: 3 });
    for (const id of target) expect((await row(id)).status).toBe('expired');
    expect(await row(target[3])).toEqual(alreadyExpired);
    expect((await row(differentPhase)).status).toBe('pending');
    expect((await row(differentProfile)).status).toBe('confirmed');
    expect((await row(differentJob)).status).toBe('declined');
    const notice = background!.calls.find(call => call.name === 'notify-staffing-cancellation')!;
    expect((await notice.result).error).toBeNull();
    expect((await notice.result).data).toMatchObject({ success: true, channel: 'email' });
    const push = background!.calls.find(call => call.name === 'push')!;
    expect((await push.result).error).toBeNull();
    const events = await h.client.from('staffing_events').select('event').in('staffing_request_id', target).eq('event', 'email_cancel_notice_sent');
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(1);
    const inbox = await h.client.from('notification_inbox').select('event_type').eq('meta->>jobId', job);
    expect(inbox.error).toBeNull();
    expect(inbox.data!.length).toBeGreaterThan(0);
    expect(inbox.data!.every(item => item.event_type === `staffing.${phase}.cancelled`)).toBe(true);
  }, 45_000);

  it('returns zero-row success and sends another notice on cancellation replay', async () => {
    const job = await h.job();
    const rid = await h.request(job, tech.id, 'offer', 'pending');
    const hook = mount();
    expect(await cancel(hook, job, 'offer')).toEqual({ success: true, rowsAffected: 1 });
    const saved = await row(rid);
    expect(await cancel(hook, job, 'offer')).toEqual({ success: true, rowsAffected: 0 });
    expect(await row(rid)).toEqual(saved);
    for (const notice of background!.calls.filter(call => call.name === 'notify-staffing-cancellation')) {
      expect((await notice.result).error).toBeNull();
      expect((await notice.result).data).toMatchObject({ success: true, channel: 'email' });
    }
    const events = await h.client.from('staffing_events').select('id').eq('staffing_request_id', rid).eq('event', 'email_cancel_notice_sent');
    expect(events.error).toBeNull();
    expect(events.data).toHaveLength(2);
  }, 45_000);

  it('a technician cannot expire their own request through the same hook', async () => {
    const job = await h.job();
    const rid = await h.request(job, tech.id, 'availability', 'pending');
    const hook = mount(tech.client);
    expect(await cancel(hook, job, 'availability')).toEqual({ success: true, rowsAffected: 0 });
    expect((await row(rid)).status).toBe('pending');
    expect(background!.calls.map(call => call.name)).toEqual(['notify-staffing-cancellation', 'push']);
    for (const call of background!.calls) {
      const error = (await call.result).error;
      expect(error?.name).toBe('FunctionsHttpError');
      expect(error?.context.status).toBe(403);
      const body = await error!.context.clone().json();
      expect(body).toMatchObject(call.name === 'notify-staffing-cancellation'
        ? { code: 'insufficient_role' } : { error: 'No tienes permiso para emitir esta notificación' });
    }
    const inbox = await h.client.from('notification_inbox').select('id').eq('meta->>jobId', job);
    expect(inbox.error).toBeNull();
    expect(inbox.data).toEqual([]);
  }, 45_000);

  it('returns success for a missing tuple although the notification function returns 404', async () => {
    const job = await h.job();
    const hook = mount();
    expect(await cancel(hook, job, 'offer')).toEqual({ success: true, rowsAffected: 0 });
    const notice = background!.calls.find(call => call.name === 'notify-staffing-cancellation')!;
    const error = (await notice.result).error;
    expect(error?.name).toBe('FunctionsHttpError');
    expect(error?.context.status).toBe(404);
    expect(await error!.context.json()).toEqual({ error: 'No staffing request found to notify' });
  }, 45_000);

  it('refreshes an active real staffing query and dispatches the update event', async () => {
    const job = await h.job();
    await h.request(job, tech.id, 'availability', 'pending');
    const hook = mount(manager.client, job);
    const key = queryKeys.scope('staffing', job, tech.id);
    await waitFor(() => expect(queryClient!.getQueryData(key)).toMatchObject({ availability_status: 'requested' }));
    const updated = vi.fn();
    window.addEventListener('staffing-updated', updated);
    try {
      await cancel(hook, job, 'availability');
      await waitFor(() => expect(queryClient!.getQueryData(key)).toMatchObject({ availability_status: null }));
      expect(updated).toHaveBeenCalledOnce();
    } finally { window.removeEventListener('staffing-updated', updated); }
  }, 45_000);

  it('uses the latest original delivery channel for the real cancellation notice', async () => {
    const job = await h.job();
    const rid = await h.request(job, tech.id, 'offer', 'confirmed');
    expect((await h.client.from('staffing_events').insert({ staffing_request_id: rid,
      event: 'whatsapp_sent', meta: {}, created_at: '2026-10-02T08:00:00Z' })).error).toBeNull();
    const hook = mount();
    expect(await cancel(hook, job, 'offer')).toEqual({ success: true, rowsAffected: 1 });
    const notice = background!.calls.find(call => call.name === 'notify-staffing-cancellation')!;
    expect((await notice.result).error).toBeNull();
    expect((await notice.result).data).toEqual({ success: true, channel: 'whatsapp' });
    const events = await h.client.from('staffing_events').select('event').eq('staffing_request_id', rid)
      .in('event', ['whatsapp_cancel_notice_sent', 'email_cancel_notice_sent']);
    expect(events.error).toBeNull();
    expect(events.data).toEqual([{ event: 'whatsapp_cancel_notice_sent' }]);
  }, 45_000);

  it('cancelling an accepted offer preserves its existing assignment and schedules', async () => {
    const job = await h.job();
    await h.request(job, tech.id, 'offer', 'confirmed');
    await h.assignment(job, tech.id, 'confirmed');
    expect((await h.client.from('timesheets').insert({ job_id: job, technician_id: tech.id, date: '2027-10-20',
      is_active: true, category: 'tecnico' })).error).toBeNull();
    const beforeAssignment = await h.client.from('job_assignments').select('*').eq('job_id', job).eq('technician_id', tech.id).single();
    const beforeTimesheets = await h.client.from('timesheets').select('*').eq('job_id', job).eq('technician_id', tech.id).order('date');
    expect(beforeAssignment.error).toBeNull(); expect(beforeTimesheets.error).toBeNull();
    const hook = mount();
    expect(await cancel(hook, job, 'offer')).toEqual({ success: true, rowsAffected: 1 });
    const afterAssignment = await h.client.from('job_assignments').select('*').eq('job_id', job).eq('technician_id', tech.id).single();
    const afterTimesheets = await h.client.from('timesheets').select('*').eq('job_id', job).eq('technician_id', tech.id).order('date');
    expect(afterAssignment.error).toBeNull(); expect(afterTimesheets.error).toBeNull();
    expect(afterAssignment.data).toEqual(beforeAssignment.data);
    expect(afterTimesheets.data).toEqual(beforeTimesheets.data);
  }, 45_000);
});
