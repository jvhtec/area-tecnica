/**
 * Listeners that clear cached Flex API tokens.
 * Called when a user updates their personal Flex API key so that
 * subsequent operations use the new key instead of the stale cache.
 */
const listeners: Array<() => void> = [];

/**
 * Registers a callback to run when the Flex API token cache is invalidated.
 *
 * @param fn - Callback invoked with no arguments when the token cache is invalidated
 */
export function onFlexTokenInvalidate(fn: () => void) {
  listeners.push(fn);
}

/**
 * Invoke all registered Flex token invalidation listeners.
 *
 * Calls each listener registered via `onFlexTokenInvalidate` and ignores any errors thrown by individual listeners.
 */
export function invalidateFlexTokenCache() {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
