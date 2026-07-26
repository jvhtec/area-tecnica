/**
 * Ambient declarations for globals the Supabase Edge Runtime injects but that are
 * not part of Deno's own type libraries.
 *
 * Loaded via `compilerOptions.types` in `supabase/functions/deno.json` so every
 * function sees them without a per-file `/// <reference>`.
 */

declare const EdgeRuntime: {
  /**
   * Keeps the worker alive until `promise` settles, so background work started
   * during a request is not cancelled when the response is returned.
   *
   * Guard with `typeof EdgeRuntime !== 'undefined'` — it is absent when a function
   * is executed outside the Supabase Edge Runtime (e.g. under `deno test`).
   */
  waitUntil(promise: Promise<unknown>): void;
};
