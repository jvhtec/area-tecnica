import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/** Observe the real SDK calls; no fabricated function responses or DB writes. */
export function trackLocalFunctions(client: SupabaseClient) {
  // The SDK getter creates a new FunctionsClient each time. Bind one real
  // instance so calls from fire-and-forget hooks can be observed and drained.
  const functions = client.functions;
  const invoke = functions.invoke.bind(functions);
  const calls: Array<{ name: string; body: unknown; result: ReturnType<typeof invoke> }> = [];
  let cleanupSafe = true;
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
    get cleanupSafe() { return cleanupSafe; },
    async drain() {
      cleanupSafe = false;
      const settled = await Promise.allSettled(calls.map(call => call.result));
      cleanupSafe = settled.every(result => result.status === 'fulfilled' &&
        (!result.value.error || result.value.error.name === 'FunctionsHttpError'));
      if (!cleanupSafe) throw new Error('Function transport did not complete; quiesce the isolated runtime before cleaning owned fixtures');
    },
    restore() { method.mockRestore(); getter.mockRestore(); },
  };
}
