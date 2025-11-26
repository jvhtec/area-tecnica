/**
 * Utility functions for detecting and handling chunk load errors
 *
 * These patterns detect when Vite's code-splitting fails to load a chunk,
 * typically after a deployment when old cached HTML tries to load new JS files.
 */

export const CHUNK_FAILURE_PATTERNS = [
  /Loading chunk [\d]+ failed/i,
  /ChunkLoadError/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
];

/**
 * Check if a message string matches known chunk load error patterns
 */
export const isChunkLoadErrorMessage = (message: string): boolean => {
  return CHUNK_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
};

/**
 * Check if an Error object represents a chunk load failure
 */
export const isChunkLoadError = (error: Error): boolean => {
  return (
    isChunkLoadErrorMessage(error.message) ||
    isChunkLoadErrorMessage(error.name)
  );
};

/**
 * Check if a browser ErrorEvent represents a chunk load failure
 */
export const isChunkLoadErrorEvent = (event: ErrorEvent): boolean => {
  const message = event.message || event.error?.message || '';
  return isChunkLoadErrorMessage(message);
};

/**
 * Check if a PromiseRejectionEvent represents a chunk load failure
 */
export const isChunkLoadPromiseRejection = (event: PromiseRejectionEvent): boolean => {
  const message = event.reason?.message || String(event.reason) || '';
  return isChunkLoadErrorMessage(message);
};
