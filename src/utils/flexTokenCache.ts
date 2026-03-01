/**
 * Listeners that clear cached Flex API tokens.
 * Called when a user updates their personal Flex API key so that
 * subsequent operations use the new key instead of the stale cache.
 */
const listeners: Array<() => void> = [];

export function onFlexTokenInvalidate(fn: () => void) {
  listeners.push(fn);
}

export function invalidateFlexTokenCache() {
  for (const fn of listeners) {
    try { fn(); } catch { /* ignore */ }
  }
}
