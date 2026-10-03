type LocalRuntime = { url: string; anon: string; service: string; fetch: typeof fetch };

/** Hold the private runtime admission fence until owned SQL cleanup finishes. */
export async function withLocalRuntimeFence<T>(runtime: LocalRuntime, cleanup: (assertFresh: () => void) => Promise<T>): Promise<T> {
  const call = async (name: string, body: unknown, timeout: number) => {
    const expires = performance.now() + timeout;
    const signal = AbortSignal.timeout(timeout);
    const response = await runtime.fetch(`${runtime.url}/functions/v1/${name}`, {
      method: 'POST', headers: { apikey: runtime.anon, Authorization: `Bearer ${runtime.service}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal,
    });
    if (response.status !== 200) throw new Error(`Local runtime fence failed: ${name} returned ${response.status}; retain fixtures`);
    const result = await response.json();
    signal.throwIfAborted();
    if (performance.now() >= expires) throw new Error('Local runtime fence deadline exceeded; retain fixtures');
    return result;
  };
  const result = await call('_local-drain', {}, 40_000);
  if (result.runtime !== 'isolated-local' || result.drain_protocol !== 1 || result.pending !== 0 || result.active !== 0 ||
      typeof result.lease !== 'string' || !/^[a-f0-9-]{36}$/.test(result.lease)) {
    throw new Error('Local runtime did not prove deferred-task completion; retain fixtures');
  }
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  // 40s drain + 45s owned cleanup + 5s release fit inside the 100s teardown
  // budget. Callers check before each mutation; an expired read cannot start
  // another delete even if the test runner did not cancel its async hook.
  const cleanupExpires = performance.now() + 45_000;
  const assertFresh = () => {
    if (performance.now() >= cleanupExpires) throw new Error('Owned cleanup deadline exceeded; retain remaining fixture IDs');
  };
  try { assertFresh(); outcome = { ok: true, value: await cleanup(assertFresh) }; }
  catch (error) { outcome = { ok: false, error }; }
  try {
    const released = await call('_local-release', { lease: result.lease }, 5_000);
    if (released.released !== true) throw new Error('Local cleanup fence was not released; require manual recovery');
  } catch (error) {
    if (!outcome.ok) throw new AggregateError([outcome.error, error], 'Owned cleanup and runtime release failed; retain fixture IDs');
    throw error;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
