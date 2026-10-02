import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { createStaffingRequestToken } from '../../supabase/functions/send-staffing-email/persistRequests';
import { PendingStaffingScopeError, preserveLegacyResendScope } from '../../supabase/functions/send-staffing-email/resendScope';
import { loadStaffingHandler, StaffingDatabase } from '../../supabase/functions/send-staffing-email/__tests__/staffingHandlerHarness';

// Opt-in, destructive fixtures ONLY on the disposable local review database.
// HTTP/PostgREST, SQL RPCs, constraints and triggers are real; delivery/auth are
// stubbed by the shared handler runner. See the review document for provisioning.
const endpoint = process.env.STAFFING_TEST_REST_URL;
const realFetch = globalThis.fetch;
const techId = 'cb910000-0000-0000-0000-000000000001';
const managerId = 'cb910000-0000-0000-0000-000000000002';
let client: SupabaseClient;
let afterBatchRefresh: (() => Promise<void>) | undefined;
let afterPendingRead: (() => Promise<void>) | undefined;

describe.skipIf(!endpoint)('staffing handlers against isolated PostgREST', () => {
  beforeAll(async () => {
    if (endpoint !== 'http://127.0.0.1:18089') throw new Error('This fixture suite only permits the disposable local review endpoint');
    client = createClient(endpoint, 'local-review-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        url.pathname = url.pathname.replace(/^\/rest\/v1/, '');
        const headers = new Headers(init?.headers);
        headers.delete('Authorization');
        const response = await realFetch(url, { ...init, headers });
        if (afterPendingRead && (!init?.method || init.method === 'GET') && url.pathname === '/staffing_requests' && url.searchParams.get('id')?.startsWith('eq.')) {
          await afterPendingRead();
        }
        if (init?.method === 'PATCH' && url.pathname === '/staffing_requests' && url.searchParams.get('id')?.startsWith('in.')) {
          const hook = afterBatchRefresh;
          afterBatchRefresh = undefined;
          await hook?.();
        }
        return response;
      } },
    });
    const { error } = await client.from('profiles').upsert([
      { id: techId, email: 'rest-tech@test.local', first_name: 'Ana', last_name: 'Tech', role: 'technician', department: 'sound' },
      { id: managerId, email: 'rest-manager@test.local', first_name: 'Review', last_name: 'Manager', role: 'management', department: 'sound' },
    ]);
    expect(error).toBeNull();
  });

  async function fixture() {
    // Keep sequential fixtures independent of earlier accepted staffing dates.
    expect((await client.from('jobs').delete().eq('title', 'Disposable staffing review')).error).toBeNull();
    const jobId = randomUUID();
    const { error } = await client.from('jobs').insert({ id: jobId, title: 'Disposable staffing review',
      start_time: '2026-10-20T08:00:00Z', end_time: '2026-10-21T18:00:00Z', job_type: 'single', status: 'Confirmado' });
    expect(error).toBeNull();
    const db = new StaffingDatabase();
    db.client = client;
    const send = (body: Record<string, unknown> = {}) => loadStaffingHandler('send-staffing-email', db)(new Request('https://edge.example.test/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer service' },
      body: JSON.stringify({ job_id: jobId, profile_id: techId, phase: 'offer', role: 'SND-FOH-R', department: 'sound', actor_id: managerId, ...body }),
    }));
    const requests = async () => {
      const { data, error } = await client.from('staffing_requests').select('*').eq('job_id', jobId).order('target_date');
      expect(error).toBeNull();
      return data!;
    };
    const activeDates = async () => {
      const { data, error } = await client.from('timesheets').select('date').eq('job_id', jobId).eq('is_active', true).order('date');
      expect(error).toBeNull();
      return data!.map(row => row.date);
    };
    const click = async (action = 'confirm') => {
      // Click the delivered credential: PostgreSQL normalizes timestamp text,
      // so re-signing a fetched row would manufacture a different token.
      const html = String(db.deliveries.at(-1)?.htmlContent);
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
      const href = hrefs.find(value => value.includes('staffing-click') && new URL(value).searchParams.get('a') === action);
      expect(href).toBeDefined();
      return loadStaffingHandler('staffing-click', db)(new Request(href!));
    };
    return { db, jobId, send, requests, activeDates, click };
  }

  it('confirms only the original batch after the job is extended', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    const original = await f.requests();
    expect(original.map(row => row.target_date)).toEqual(['2026-10-20', '2026-10-21']);
    expect((await client.from('jobs').update({ end_time: '2026-10-23T18:00:00Z' }).eq('id', f.jobId)).error).toBeNull();
    await f.click();
    expect(await f.activeDates()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it.each([false, true])('rolls back every internal write on a late timesheet failure (existing membership: %s)', async existing => {
    const f = await fixture();
    if (existing) {
      expect((await client.from('job_assignments').insert({ job_id: f.jobId, technician_id: techId,
        status: 'confirmed', single_day: true, assignment_date: '2026-10-19', sound_role: 'SND-MON-R' })).error).toBeNull();
      expect((await client.from('timesheets').insert({ job_id: f.jobId, technician_id: techId,
        date: '2026-10-19', notes: 'Approved', approved_by_manager: true, source: 'staffing' })).error).toBeNull();
    }
    const { data: assignments } = await client.from('job_assignments').select('*').eq('job_id', f.jobId);
    const { data: schedule } = await client.from('timesheets').select('*').eq('job_id', f.jobId);
    expect((await f.send()).status).toBe(200);
    expect((await client.from('staffing_test_faults').insert({ job_id: f.jobId, fail_date: '2026-10-21' })).error).toBeNull();
    await f.click();
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    expect((await client.from('job_assignments').select('*').eq('job_id', f.jobId)).data).toEqual(assignments);
    expect((await client.from('timesheets').select('*').eq('job_id', f.jobId)).data).toEqual(schedule);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', (await f.requests()).map(row => row.id));
    expect(events?.some(row => row.event === 'auto_assign_error')).toBe(true);
    expect(events?.some(row => row.event === 'auto_assigned_on_confirm')).toBe(false);
  });

  it.each([false, true])('elects one response writer for two simultaneous clicks (single date: %s)', async singleDay => {
    const f = await fixture();
    expect((await f.send(singleDay ? { single_day: true, target_date: '2026-10-20' } : {})).status).toBe(200);
    let reads = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    afterPendingRead = async () => {
      if (++reads === 2) { afterPendingRead = undefined; release(); }
      await barrier;
    };
    try {
      const responses = await Promise.all([f.click(), f.click()]);
      expect(responses.map(response => response.status)).toEqual([302, 302]);
      expect(responses.map(response => new URL(response.headers.get('location')!).searchParams.get('status')).sort())
        .toEqual(['success', 'warning']);
    } finally {
      afterPendingRead = undefined;
      release();
    }
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    const { data: memberships, error } = await client.from('job_assignments').select('*').eq('job_id', f.jobId);
    expect(error).toBeNull();
    expect(memberships).toHaveLength(1);
    expect(memberships![0].status).toBe('confirmed');
    expect(await f.activeDates()).toEqual(singleDay ? ['2026-10-20'] : ['2026-10-20', '2026-10-21']);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', (await f.requests()).map(row => row.id));
    expect(events?.filter(row => row.event === 'clicked_confirm')).toHaveLength(1);
    expect(events?.filter(row => row.event === 'auto_assigned_on_confirm')).toHaveLength(1);
  });

  it('retains the response and existing booking when a conflict appears after sending', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    const otherJobId = randomUUID();
    expect((await client.from('jobs').insert({ id: otherJobId, title: 'Disposable staffing review',
      start_time: '2026-10-20T08:00:00Z', end_time: '2026-10-20T18:00:00Z', job_type: 'single', status: 'Confirmado' })).error).toBeNull();
    expect((await client.from('job_assignments').insert({ job_id: otherJobId, technician_id: techId,
      status: 'confirmed', single_day: true, assignment_date: '2026-10-20' })).error).toBeNull();
    expect((await client.from('timesheets').insert({ job_id: otherJobId, technician_id: techId,
      date: '2026-10-20', is_active: true, notes: 'Keep existing booking' })).error).toBeNull();
    const before = (await client.from('timesheets').select('*').eq('job_id', otherJobId)).data;
    await f.click();
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    expect((await client.from('job_assignments').select('*').eq('job_id', f.jobId)).data).toEqual([]);
    expect(await f.activeDates()).toEqual([]);
    expect((await client.from('timesheets').select('*').eq('job_id', otherJobId)).data).toEqual(before);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', (await f.requests()).map(row => row.id));
    expect(events?.some(row => row.event === 'auto_assign_skipped_conflict')).toBe(true);
    expect(f.db.externalRequests.some(url => url.includes('manage-flex-crew-assignments'))).toBe(false);
  });

  it.each([false, true])('does not overwrite the winning response when confirm and decline race (single date: %s)', async singleDay => {
    const f = await fixture();
    expect((await f.send(singleDay ? { single_day: true, target_date: '2026-10-20' } : {})).status).toBe(200);
    let reads = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    afterPendingRead = async () => {
      if (++reads === 2) { afterPendingRead = undefined; release(); }
      await barrier;
    };
    let responses: Response[];
    try {
      responses = await Promise.all([f.click(), f.click('decline')]);
    } finally {
      afterPendingRead = undefined;
      release();
    }
    const requests = await f.requests();
    const winner = requests[0].status;
    expect(['confirmed', 'declined']).toContain(winner);
    expect(requests.every(row => row.status === winner)).toBe(true);
    expect(responses.map(response => response.status)).toEqual([302, 302]);
    const loser = responses.find(response => new URL(response.headers.get('location')!).searchParams.get('status') === 'warning');
    expect(loser).toBeDefined();
    expect(new URL(loser!.headers.get('location')!).searchParams.get('message'))
      .toContain(winner === 'confirmed' ? 'confirmado' : 'rechazado');
    expect(await f.activeDates()).toEqual(winner === 'confirmed'
      ? singleDay ? ['2026-10-20'] : ['2026-10-20', '2026-10-21'] : []);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', requests.map(row => row.id));
    expect(events?.filter(row => row.event === 'clicked_confirm' || row.event === 'clicked_decline')).toHaveLength(1);
  });

  it('keeps the confirmed response without a schedule when the assignment write fails', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    expect((await client.from('staffing_test_faults').insert({ job_id: f.jobId, fail_assignment: true })).error).toBeNull();
    await f.click();
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    expect((await client.from('job_assignments').select('*').eq('job_id', f.jobId)).data).toEqual([]);
    expect(await f.activeDates()).toEqual([]);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', (await f.requests()).map(row => row.id));
    expect(events?.some(row => row.event === 'auto_assign_upsert_error')).toBe(true);
    expect(events?.some(row => row.event === 'auto_assigned_on_confirm')).toBe(false);
    expect(f.db.externalRequests.some(url => url.includes('manage-flex-crew-assignments'))).toBe(false);
  });

  it('keeps committed membership and schedule when the external Flex service returns an error', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    f.db.externalStatus = 503;
    await f.click();
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    expect((await client.from('job_assignments').select('*').eq('job_id', f.jobId)).data).toHaveLength(1);
    expect(await f.activeDates()).toEqual(['2026-10-20', '2026-10-21']);
    expect(f.db.externalRequests.some(url => url.includes('manage-flex-crew-assignments'))).toBe(true);
    const { data: events } = await client.from('staffing_events').select('event').in('staffing_request_id', (await f.requests()).map(row => row.id));
    expect(events?.some(row => row.event === 'auto_assigned_on_confirm')).toBe(true);
  });

  it('serializes two overlapping RPC transactions and preserves the first membership scope', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    const requests = await f.requests();
    expect((await client.from('staffing_requests').update({ status: 'confirmed' }).eq('job_id', f.jobId)).error).toBeNull();
    expect((await client.from('staffing_test_faults').insert({ job_id: f.jobId, delay_assignment: true })).error).toBeNull();
    const completion: string[] = [];
    const attempts = await Promise.all(requests.map(async request => {
      const result = await client.rpc('assign_staffing_offer', { p_request_id: request.id,
        p_dates: [request.target_date], p_single_day: true, p_role: 'SND-FOH-R' });
      completion.push(request.target_date);
      return result;
    }));
    expect(attempts.map(result => result.error)).toEqual([null, null]);
    expect(attempts[0].data).toBe(attempts[1].data);
    const { data: memberships } = await client.from('job_assignments').select('*').eq('job_id', f.jobId);
    expect(memberships).toHaveLength(1);
    expect(memberships![0]).toMatchObject({ status: 'confirmed', single_day: true, assignment_date: completion[0] });
    expect(await f.activeDates()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('preserves approved prep data while the real click handler appends accepted dates', async () => {
    const f = await fixture();
    expect((await client.from('job_date_types').insert([
      { job_id: f.jobId, date: '2026-10-19', type: 'prep_day' },
      { job_id: f.jobId, date: '2026-10-20', type: 'show' },
      { job_id: f.jobId, date: '2026-10-21', type: 'show' },
    ])).error).toBeNull();
    expect((await client.from('job_assignments').insert({ job_id: f.jobId, technician_id: techId,
      status: 'confirmed', single_day: true, assignment_date: '2026-10-19', sound_role: 'SND-FOH-R' })).error).toBeNull();
    expect((await client.from('timesheets').update({ start_time: '09:00', end_time: '17:00', notes: 'Keep approval', approved_by_manager: true })
      .eq('job_id', f.jobId).eq('date', '2026-10-19')).error).toBeNull();
    const { data: before } = await client.from('timesheets').select('*').eq('job_id', f.jobId).eq('date', '2026-10-19').single();
    expect((await f.send()).status).toBe(200);
    await f.click();
    expect(await f.activeDates()).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    const { data: after } = await client.from('timesheets').select('*').eq('job_id', f.jobId).eq('date', '2026-10-19').single();
    expect(after).toEqual(before);
  });

  it('refreshes a legacy request without leaving an old active WhatsApp link', async () => {
    const f = await fixture();
    const id = randomUUID();
    const expiry = new Date(Date.now() + 60_000).toISOString();
    const credentials = await createStaffingRequestToken('test-secret', id, 'offer', expiry);
    const { error } = await client.from('staffing_requests').insert({ id, job_id: f.jobId, profile_id: techId,
      phase: 'offer', status: 'pending', single_day: false, role_code: 'SND-FOH-R',
      token_expires_at: expiry, token_hash: credentials.token_hash, requested_by: managerId });
    expect(error).toBeNull();
    expect((await f.send({ resend_request_id: id })).status).toBe(200);
    expect(await f.requests()).toHaveLength(1);
    await loadStaffingHandler('staffing-click', f.db)(new Request(`https://edge.example.test/staffing-click/confirm/${id}/${credentials.token}`));
    expect((await f.requests())[0].status).toBe('pending');
    expect((await client.from('jobs').update({ end_time: '2026-10-23T18:00:00Z' }).eq('id', f.jobId)).error).toBeNull();
    await f.click();
    expect(await f.activeDates()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('resends availability by a batch member and retains IDs and exact dates', async () => {
    const f = await fixture();
    expect((await f.send({ phase: 'availability' })).status).toBe(200);
    const original = await f.requests();
    expect((await f.send({ phase: 'availability', resend_request_id: original[1].id })).status).toBe(200);
    expect((await f.requests()).map(row => [row.id, row.target_date, row.batch_id])).toEqual(original.map(row => [row.id, row.target_date, row.batch_id]));
    await f.click();
    expect((await f.requests()).every(row => row.status === 'confirmed')).toBe(true);
    expect(await f.activeDates()).toEqual([]);
  });

  it('does not change a declined response through a sequential repeated link', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    await f.click('decline');
    await f.click();
    expect((await f.requests()).every(row => row.status === 'declined')).toBe(true);
    expect(await f.activeDates()).toEqual([]);
  });

  it('uses the database primary key to elect one immutable concurrent legacy scope', async () => {
    const f = await fixture();
    const id = randomUUID();
    const expiry = new Date(Date.now() + 60_000).toISOString();
    const credentials = await createStaffingRequestToken('test-secret', id, 'offer', expiry);
    expect((await client.from('staffing_requests').insert({ id, job_id: f.jobId, profile_id: techId,
      phase: 'offer', status: 'pending', single_day: false, role_code: 'SND-FOH-R', requested_by: managerId,
      token_hash: credentials.token_hash, token_expires_at: expiry })).error).toBeNull();
    const attempts = await Promise.allSettled([
      preserveLegacyResendScope(client, id, 'offer', ['2026-10-20'], 'SND-FOH-R'),
      preserveLegacyResendScope(client, id, 'offer', ['2026-10-20', '2026-10-21'], 'SND-FOH-R'),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const loser = attempts.find(result => result.status === 'rejected');
    expect(loser?.status === 'rejected' && loser.reason).toBeInstanceOf(PendingStaffingScopeError);
    const { data, error } = await client.from('staffing_events').select('meta').eq('staffing_request_id', id).eq('event', 'request_scope');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('rejects a superseded resend without splitting batch credentials through real HTTP writes', async () => {
    const f = await fixture();
    expect((await f.send()).status).toBe(200);
    const id = (await f.requests())[0].id;
    let competingStatus: number | undefined;
    afterBatchRefresh = async () => { competingStatus = (await f.send({ resend_request_id: id })).status; };
    expect((await f.send({ resend_request_id: id })).status).toBe(409);
    expect(competingStatus).toBe(200);
    expect(new Set((await f.requests()).map(row => row.token_hash)).size).toBe(1);
    expect(f.db.deliveries).toHaveLength(2);
    await f.click();
    expect(await f.activeDates()).toEqual(['2026-10-20', '2026-10-21']);
  });
});
