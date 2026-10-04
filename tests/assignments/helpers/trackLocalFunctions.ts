import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/** Observe the real SDK calls; no fabricated function responses or DB writes. */
export function trackLocalFunctions(client: SupabaseClient) {
  // The SDK getter creates a new FunctionsClient each time. Bind one real
  // instance so calls from fire-and-forget hooks can be observed and drained.
  const functions = client.functions;
  const invoke = functions.invoke.bind(functions);
  const calls: Array<{ name: string; body: unknown; result: ReturnType<typeof invoke> }> = [];
  const rpcResults: PromiseLike<unknown>[] = [];
  const rpc = client.rpc.bind(client);
  const rpcMethod = vi.spyOn(client, 'rpc').mockImplementation((...args) => {
    const request = rpc(...args);
    const then = request.then.bind(request);
    vi.spyOn(request, 'then').mockImplementation((fulfilled, rejected) => {
      // Observe the SDK's existing consumption; awaiting the builder ourselves
      // would execute the RPC twice. Keep fluent builder methods intact.
      const result = then();
      rpcResults.push(result);
      return result.then(fulfilled, rejected);
    });
    return request;
  });
  let transportComplete = true;
  const getter = vi.spyOn(client, 'functions', 'get').mockReturnValue(functions);
  const method = vi.spyOn(functions, 'invoke').mockImplementation((name, options) => {
    // Do not abort an in-flight handler and mistake client settlement for
    // server completion. HTTP error responses are complete; transport errors
    // leave quiescence unknown and must prevent automatic fixture deletion.
    const result = invoke(name, options);
    calls.push({ name, body: options?.body, result });
    return result;
  });
  return {
    calls,
    get rpcResults() { return [...rpcResults]; },
    // This proves HTTP completion only. Fixture deletion separately requires
    // the local runtime fence to drain deferred work and hold admission closed.
    get transportComplete() { return transportComplete; },
    async drain() {
      transportComplete = false;
      let functions: PromiseSettledResult<Awaited<ReturnType<typeof invoke>>>[];
      let requests: PromiseSettledResult<unknown>[];
      let observed: number;
      do {
        observed = calls.length + rpcResults.length;
        [functions, requests] = await Promise.all([
          Promise.allSettled(calls.map(call => call.result)),
          Promise.allSettled(rpcResults),
        ]);
        // A completed claim can start functions; completed functions can start
        // the ledger report. Drain that entire chain before fixture cleanup.
      } while (observed !== calls.length + rpcResults.length);
      transportComplete = functions.every(result => result.status === 'fulfilled' &&
        (!result.value.error || result.value.error.name === 'FunctionsHttpError')) &&
        requests.every(result => result.status === 'fulfilled' && !(
          result.value && typeof result.value === 'object' && 'error' in result.value &&
          result.value.error && typeof result.value.error === 'object' &&
          'code' in result.value.error && result.value.error.code === ''
        ));
      if (!transportComplete) throw new Error('Function transport did not complete; quiesce the isolated runtime before cleaning owned fixtures');
    },
    restore() { method.mockRestore(); getter.mockRestore(); rpcMethod.mockRestore(); },
  };
}
