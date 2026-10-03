import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { readCiCampaignTarget, verifyCiCampaignTarget } from './helpers/ciCampaignTarget';

// Empty synthetic stack only. No jobs, profiles, auth users or SQL are created.
// Capture a native fetch before setup.ts replaces it for ordinary unit tests.
const nativeFetch = globalThis.fetch;
describe.skipIf(!process.env.STAFFING_CI_MANIFEST)('native synthetic CI runtime completion protocol', () => {
  let url: string;
  let service: string;
  let anon: string;
  const call = async (path: string, method = 'GET', body?: unknown, authenticated = true) => {
    const response = await nativeFetch(url + path, { method, redirect: 'error',
      headers: authenticated ? { apikey: service, authorization: `Bearer ${service}`, 'content-type': 'application/json' } : {},
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45_000) });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  const drain = async () => {
    const result = await call('/functions/v1/_local-drain', 'POST', {});
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ runtime: 'isolated-local', drain_protocol: 1, active: 0, pending: 0 });
    expect(result.body.lease).toMatch(/^[a-f0-9-]{36}$/);
    return result.body.lease as string;
  };
  const release = async (lease: string) => {
    expect(await call('/functions/v1/_local-release', 'POST', { lease })).toEqual({ status: 200, body: { released: true } });
  };
  beforeAll(async () => {
    const target = readCiCampaignTarget();
    verifyCiCampaignTarget(target, (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 15_000, maxBuffer: 64 * 1024 * 1024 }));
    url = target.url;
    expect(process.env.STAFFING_EDGE_TEST_URL).toBe(url);
    service = process.env.STAFFING_EDGE_TEST_SERVICE_KEY!; anon = process.env.STAFFING_EDGE_TEST_ANON_KEY!;
    for (const [key, role] of [[service, 'service_role'], [anon, 'anon']]) {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      expect(claims).toMatchObject({ iss: 'supabase-demo', role });
    }
    const health = await call('/functions/v1/_local-health');
    expect(health.body).toMatchObject({ target: 'synthetic-ci', unsafe: false, leased: false, foreground: 0 });
    // Public source parity above does not prove the prelude executed. Load all
    // actual native workers and require their acknowledgments before fixtures.
    expect(await call('/functions/v1/_local-bootstrap', 'POST', {})).toEqual({ status: 200, body: { bootstrapped: 5 } });
  }, 120_000);

  it('rejects unauthorized runtime controls, inherited routes and JWT-protected handlers', async () => {
    expect((await call('/functions/v1/_local-drain', 'POST', {}, false)).status).toBe(401);
    expect((await call('/functions/v1/constructor', 'GET', undefined, false)).status).toBe(404);
    expect((await call('/functions/v1/push', 'POST', {}, false)).status).toBe(401);
    expect((await call('/_ci-gateway-state', 'GET', undefined, false)).status).toBe(401);
  });
  it.each(['_ci-probe-modern', '_ci-probe-legacy'])('%s holds drain until its registered task finishes', async slug => {
    const id = randomUUID();
    expect((await call(`/functions/v1/${slug}?id=${id}`)).status).toBe(200);
    let settled = false;
    const pending = drain().then(lease => { settled = true; return lease; });
    try {
      // Observe the admission lease before checking that the blocked task has
      // not completed. The gate, not elapsed time, controls deferred work.
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await call('/functions/v1/_local-health')).body.leased) break;
        if (attempt === 99) throw new Error('Native drain did not acquire its lease');
      }
      expect(settled).toBe(false);
      expect((await call(`/_ci-capture/marker?id=${id}`)).body.complete).toBe(false);
      expect((await call('/functions/v1/_ci-probe-modern?mode=status500')).status).toBe(503);
    } finally {
      expect((await call(`/_ci-capture/gate?id=${id}`, 'POST', {})).status).toBe(200);
      const lease = await pending;
      expect((await call(`/_ci-capture/marker?id=${id}`)).body.complete).toBe(true);
      await release(lease);
    }
  }, 60_000);
  it.each(['_ci-probe-modern', '_ci-probe-legacy'])('%s accepts completed errors and ignored or cancelled bodies', async slug => {
    for (const mode of ['status500', 'status503', 'ignored', 'cancel', 'parse-error']) {
      expect((await call(`/functions/v1/${slug}?mode=${mode}`)).status).toBe(mode.startsWith('status') ? Number(mode.slice(-3)) : 200);
      await release(await drain());
    }
  }, 90_000);
  it('accounts for nested workers and rechecks REST completed during the cleanup lease', async () => {
    expect((await call('/functions/v1/_ci-probe-modern?mode=nested')).body).toEqual({ nested: 503 });
    const lease = await drain();
    const before = (await call('/_ci-gateway-state')).body;
    expect((await call('/rest/v1/jobs?select=id&limit=0')).status).toBe(200);
    const after = (await call('/_ci-gateway-state')).body;
    expect(after.boot).toBe(before.boot); expect(after.generation).toBeGreaterThan(before.generation);
    expect(after).toMatchObject({ active: 0, uncertainty: 0 });
    expect((await call('/functions/v1/_local-release', 'POST', { lease: randomUUID() })).status).toBe(409);
    await release(lease);
  }, 60_000);
});
