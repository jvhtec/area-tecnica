import { createHash, randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { disposableCampaignHarness } from './helpers/disposableCampaignHarness';
import { localRequestSafety } from './helpers/localRequestSafety';

const nativeFetch = globalThis.fetch;
type Action = 'confirm' | 'decline';
type Style = 'path' | 'legacy';

describe.skipIf(!process.env.STAFFING_DISPOSABLE_MANIFEST)('actual public staffing-click methods on disposable clone (P0.21)', () => {
  let h: ReturnType<typeof disposableCampaignHarness>;
  let tech: Awaited<ReturnType<typeof h.user>>;
  let baseline: string[];
  let historicalBaseline: string[];
  const publicRequests = localRequestSafety();
  beforeAll(async () => {
    h = disposableCampaignHarness(['staffing-click/index.ts']);
    await h.prepare(); baseline = h.fingerprint(); historicalBaseline = h.historicalFingerprint(); tech = await h.user();
  }, 90_000);
  beforeEach(() => { publicRequests.assertSafe(); h?.assertFixtureSafe(); });
  afterEach(async () => { publicRequests.assertSafe(); await h?.cleanJobs(); }, 100_000);
  afterAll(async () => {
    if (!h) return;
    publicRequests.assertSafe();
    const failures: unknown[] = [];
    for (const action of [h.cleanJobs, h.cleanUsers, h.finish]) {
      try { await action(); } catch (error) { failures.push(error); }
    }
    try { expect(h.fingerprint()).toEqual(baseline); expect(h.historicalFingerprint()).toEqual(historicalBaseline); } catch (error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures, 'Public method cleanup/preservation failed');
  }, 200_000);

  async function fixture() {
    const jobId = await h.job();
    const id = await h.request(jobId, tech.id, 'availability', 'pending', null);
    const bytes = randomBytes(32);
    const token = bytes.toString('base64url');
    const expiry = '2028-01-01T00:00:00Z';
    expect((await h.client.from('staffing_requests').update({
      token_hash: createHash('sha256').update(bytes).digest('hex'), token_expires_at: expiry,
    }).eq('id', id)).error).toBeNull();
    return { jobId, id, token, expiry };
  }
  async function row(id: string) {
    const result = await h.client.from('staffing_requests').select('*').eq('id', id).single();
    expect(result.error).toBeNull(); return result.data!;
  }
  async function events(id: string) {
    const result = await h.client.from('staffing_events').select('event').eq('staffing_request_id', id).order('event');
    expect(result.error).toBeNull(); return result.data!.map(item => item.event);
  }
  function link(f: Awaited<ReturnType<typeof fixture>>, action: Action, style: Style, token = f.token) {
    const root = `${h.localUrl}/functions/v1/staffing-click`;
    return style === 'path' ? `${root}/${action}/${f.id}/${token}?c=email`
      : `${root}?${new URLSearchParams({ rid:f.id, a:action, t:token, exp:f.expiry, c:'email' })}`;
  }
  async function click(url: string, method: string, body?: string) {
    publicRequests.assertSafe();
    const parsed = new URL(url);
    if (parsed.origin !== h.localUrl || !parsed.pathname.startsWith('/functions/v1/staffing-click')) throw new Error('Only owned clone public handler permitted');
    return publicRequests.run(async () => {
      // Public capability links have no caller Authorization header. Never
      // follow a result redirect into the original app or an external site.
      const response = await nativeFetch(url, { method, redirect:'manual', body,
        headers:{apikey:process.env.STAFFING_EDGE_TEST_ANON_KEY!, 'Content-Type':'application/json'},
        signal:AbortSignal.timeout(40_000) });
      return {status:response.status, text:await response.text()};
    });
  }
  async function unchanged(f: Awaited<ReturnType<typeof fixture>>, before: Awaited<ReturnType<typeof row>>) {
    await h.withCleanupFence(async () => undefined);
    expect(await row(f.id)).toEqual(before);
    expect(await events(f.id)).toEqual([]);
  }

  for (const style of ['legacy','path'] as const) {
    it(`${style} HEAD is inert with a valid confirm credential`, async () => {
      const f = await fixture(); const before = await row(f.id);
      expect(await click(link(f,'confirm',style),'HEAD')).toEqual({status:204,text:''});
      await unchanged(f,before);
    }, 45_000);
    for (const method of ['GET','POST']) for (const action of ['confirm','decline'] as const) {
      it(`${style} ${method} ${action} currently records one response and replay is inert`, async () => {
        const f = await fixture();
        const response = await click(link(f,action,style),method);
        expect(response.status).toBe(200);
        expect(response.text).toContain('Tu respuesta sobre la disponibilidad ha sido registrada.');
        await h.withCleanupFence(async () => undefined);
        const recorded = await row(f.id);
        expect(recorded.status).toBe(action==='confirm' ? 'confirmed' : 'declined');
        expect(await events(f.id)).toEqual([`clicked_${action}`]);
        const assignments = await h.client.from('job_assignments').select('job_id').eq('job_id',f.jobId);
        expect(assignments.error).toBeNull(); expect(assignments.data).toEqual([]);
        const replay = await click(link(f,action==='confirm' ? 'decline' : 'confirm',style),method);
        expect(replay.status).toBe(200); expect(replay.text).toContain('Respuesta ya registrada');
        await h.withCleanupFence(async () => undefined);
        expect(await row(f.id)).toEqual(recorded);
        expect(await events(f.id)).toEqual([`clicked_${action}`]);
      }, 45_000);
    }
    it(`${style} invalid token GET cannot change the pending request`, async () => {
      const f = await fixture(); const before = await row(f.id);
      const response = await click(link(f,'confirm',style,randomBytes(32).toString('base64url')),'GET');
      expect(response.status).toBe(200); expect(response.text).toContain('Token inválido');
      await unchanged(f,before);
    }, 45_000);
    it(`${style} expired credential GET cannot change the pending request`, async () => {
      const f = await fixture();
      expect((await h.client.from('staffing_requests').update({token_expires_at:'2020-01-01T00:00:00Z'}).eq('id',f.id)).error).toBeNull();
      const before = await row(f.id);
      const response = await click(link(f,'confirm',style),'GET');
      expect(response.status).toBe(200); expect(response.text).toContain('Enlace caducado');
      await unchanged(f,before);
    }, 45_000);
  }
  it('POST body credentials alone are ignored by the current URL parser', async () => {
    const f = await fixture(); const before = await row(f.id);
    const response = await click(`${h.localUrl}/functions/v1/staffing-click`,'POST',
      JSON.stringify({rid:f.id,a:'confirm',t:f.token,exp:f.expiry}));
    expect(response.status).toBe(200); expect(response.text).toContain('Enlace inválido');
    await unchanged(f,before);
  }, 45_000);
});
