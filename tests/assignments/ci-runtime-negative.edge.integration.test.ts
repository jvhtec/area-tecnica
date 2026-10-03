import { execFileSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { readCiCampaignTarget, verifyCiCampaignTarget } from './helpers/ciCampaignTarget';

const nativeFetch = globalThis.fetch;
const mode = process.env.STAFFING_CI_NEGATIVE_PROBE;
// Each mode deliberately poisons completion certainty. Run on an empty stack
// with a fresh runtime; this suite never clears uncertainty or removes fixtures.
describe.skipIf(!mode)('native CI completion refusal after handled transport failure', () => {
  let url: string, service: string;
  const call = async (path: string, method = 'GET') => {
    const response = await nativeFetch(url + path, { method, headers: { apikey: service, authorization: `Bearer ${service}` },
      signal: AbortSignal.timeout(50_000), redirect: 'error' });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  beforeAll(() => {
    if (!['abort', 'truncated', 'timeout'].includes(mode!)) throw new Error('Unknown native CI negative probe');
    const target = readCiCampaignTarget();
    const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 });
    verifyCiCampaignTarget(target, docker);
    const tables = ['jobs', 'staffing_requests', 'job_assignments', 'timesheets', 'profiles', 'activity_log',
      'notification_inbox', 'push_delivery_attempts', 'staffing_campaigns', 'staffing_campaign_roles', 'staffing_events', 'technician_fridge'];
    const empty = docker('exec', target.database, 'psql', '-h', '/var/run/postgresql', '-XqAt', '-v', 'ON_ERROR_STOP=1',
      '-U', 'postgres', '-d', 'postgres', '-c', `SELECT (SELECT count(*) FROM auth.users)=0 AND ${tables.map(table => `(SELECT count(*) FROM public.${table})=0`).join(' AND ')};`);
    expect(empty.trim()).toBe('t');
    url = target.url; service = process.env.STAFFING_EDGE_TEST_SERVICE_KEY!;
    expect(process.env.STAFFING_EDGE_TEST_URL).toBe(url);
    expect(JSON.parse(Buffer.from(service.split('.')[1], 'base64url').toString())).toMatchObject({ iss: 'supabase-demo', role: 'service_role' });
  }, 60_000);
  it('keeps cleanup refused after the callback handles its failure and gateway becomes idle', async () => {
    const health = await call('/functions/v1/_local-health');
    expect(health.body).toMatchObject({ unsafe: false, leased: false, foreground: 0 });
    const results = await Promise.all(['_ci-probe-modern', '_ci-probe-legacy'].map(slug => call(`/functions/v1/${slug}?mode=${mode}`)));
    for (const result of results) {
      expect(mode === 'timeout' ? [200, 502] : [200]).toContain(result.status);
      if (result.status === 200) expect(result.body).toEqual({ handled: true });
    }
    const refused = await call('/functions/v1/_local-drain', 'POST');
    expect(refused.status).toBe(503);
    expect((await call('/functions/v1/_local-health')).body).toMatchObject({ unsafe: true, leased: true });
    // The remote completion latch cannot be cleared by a subsequent idle view.
    const deadline = performance.now() + 5_000;
    let state;
    do {
      state = (await call('/_ci-gateway-state')).body;
      if (state.active === 0) break;
    } while (performance.now() < deadline);
    expect(state.active).toBe(0);
    if (mode !== 'abort') expect(state.uncertainty).toBe(1);
    expect((await call('/functions/v1/_local-drain', 'POST')).status).toBe(409);
  }, 120_000);
});
