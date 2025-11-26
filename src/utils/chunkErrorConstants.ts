/**
 * Shared constants for chunk load error recovery system
 * Used across ErrorBoundary.tsx and main.tsx to coordinate reload attempts
 */

export const CHUNK_ERROR_RELOAD_KEY = 'chunk-error-reload-count';
export const MAX_CHUNK_ERROR_RELOADS = 2;
