import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { localCampaignHarness } from './helpers/localCampaignHarness';

// Synthetic private-runtime markers only. No application fault triggers or
// historical identities are required to prove response-before-task ordering.
describe.skipIf(!process.env.STAFFING_EDGE_TEST_URL)('actual deferred-task cleanup fence on local Edge Runtime', () => {
  let h: ReturnType<typeof localCampaignHarness>;
  let baseline: string[];
  beforeAll(async () => {
    h = localCampaignHarness();
    await h.prepare();
    baseline = h.fingerprint();
  }, 60_000);
  afterAll(() => {
    if (!h) return;
    h.assertCleanupSafe();
    if (baseline) expect(h.fingerprint()).toEqual(baseline);
  }, 30_000);

  async function invoke(name: string, body?: unknown, method: 'GET' | 'POST' = 'POST') {
    const result = await h.client.functions.invoke(name, { body, method });
    expect(result.error).toBeNull();
    return result.data;
  }

  it.each(['_local-task-probe', '_local-task-probe-legacy'])(
    '%s responds before its task but cleanup waits and holds admission closed', async name => {
      const marker = randomUUID(); const gate = randomUUID();
      expect(await invoke(name, { marker, gate })).toEqual({ scheduled: true });
      expect(await invoke(`${name}?marker=${marker}`, undefined, 'GET')).toEqual({ completed: false });
      const cleanup = vi.fn(async () => {
        expect(await invoke(`${name}?marker=${marker}`, undefined, 'GET')).toEqual({ completed: true });
        const denied = await h.client.functions.invoke(name, { body: { marker: randomUUID() } });
        expect(denied.error?.context.status).toBe(503);
      });
      const fenced = h.withCleanupFence(cleanup);
      try {
        await vi.waitFor(async () => expect((await invoke('_local-health')).leased).toBe(true));
        expect(cleanup).not.toHaveBeenCalled();
        expect(() => h.assertCleanupSafe()).toThrow('Owned fixtures retained');
      } finally {
        await invoke('_local-task-gate', { marker: gate });
        await fenced;
      }
      expect(cleanup).toHaveBeenCalledOnce();
      expect((await invoke('_local-health')).leased).toBe(false);
    }, 30_000);
});
