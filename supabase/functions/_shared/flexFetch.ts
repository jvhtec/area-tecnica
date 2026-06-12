/**
 * Shared fetch wrapper for Flex Rental Solutions API calls.
 *
 * Every call gets a timeout (Flex occasionally hangs) and transient
 * failures are retried with exponential backoff. 4xx responses are never
 * retried — they are deterministic. Timeouts are only retried when the
 * caller opts in (`retryOnTimeout`): for non-idempotent POSTs a timed-out
 * request may have been processed by Flex, and a blind retry would
 * duplicate the side effect.
 */

export interface FlexFetchOptions {
  /** Total attempts including the first one. Default 3. */
  attempts?: number;
  /** Per-attempt timeout in milliseconds. Default 15000. */
  timeoutMs?: number;
  /** Base backoff delay; grows exponentially (1x, 2x, 4x…). Default 1000. */
  backoffMs?: number;
  /**
   * Retry attempts whose outcome is ambiguous — timeouts and 502/504 gateway
   * responses, where the origin may have already processed the request.
   * Default true; set false for non-idempotent requests. (To disable retries
   * entirely, pass `attempts: 1`.)
   */
  retryOnTimeout?: boolean;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// Gateway statuses where the origin may have already processed the request —
// replaying them has the same duplicate-side-effect risk as replaying a timeout.
const AMBIGUOUS_STATUSES = new Set([502, 504]);

export class FlexFetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Flex request timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FlexFetchTimeoutError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FlexFetchOptions = {},
): Promise<Response> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const timeoutMs = options.timeoutMs ?? 15000;
  const backoffMs = options.backoffMs ?? 1000;
  const retryOnTimeout = options.retryOnTimeout ?? true;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });

      const retryable = RETRYABLE_STATUSES.has(response.status) &&
        (retryOnTimeout || !AMBIGUOUS_STATUSES.has(response.status));
      if (!retryable || attempt === attempts) {
        return response;
      }

      // Drain the body so the connection can be reused before retrying.
      await response.body?.cancel().catch(() => undefined);
      lastError = new Error(`Flex returned HTTP ${response.status}`);
    } catch (error) {
      const timedOut = controller.signal.aborted;
      lastError = timedOut ? new FlexFetchTimeoutError(url, timeoutMs) : error;

      // Fetch rejections can happen after the request reached the origin
      // (for example, a connection reset while reading the response). Treat
      // every thrown error as ambiguous for non-idempotent callers.
      if (!retryOnTimeout || attempt === attempts) {
        throw lastError;
      }
    } finally {
      clearTimeout(timer);
    }

    await sleep(backoffMs * 2 ** (attempt - 1));
  }

  // Unreachable: the loop always returns or throws on the final attempt.
  throw lastError;
}
