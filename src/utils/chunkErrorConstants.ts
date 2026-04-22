/**
 * Shared constants for chunk load error recovery system
 * Used across ErrorBoundary.tsx and main.tsx to coordinate reload attempts
 */

export const CHUNK_ERROR_RELOAD_KEY = 'chunk-error-reload-count';
/**
 * Companion key that records which ErrorBoundary instance last incremented the
 * counter so sibling boundaries do not wipe it via their mount-time clear timer.
 */
export const CHUNK_ERROR_RELOAD_OWNER_KEY = 'chunk-error-reload-owner';
/**
 * If the owner entry is older than this, any boundary may clear the counter —
 * this prevents a crashed instance from permanently pinning the counter.
 */
export const CHUNK_ERROR_RELOAD_OWNER_TTL_MS = 60_000;
export const MAX_CHUNK_ERROR_RELOADS = 2;
