const DEFAULT_SEND_CONCURRENCY = 1;
const MAX_SEND_CONCURRENCY = 4;

/** Resolve the number of concurrent WAHA sends for a bulk job message. */
export function resolveWhatsappSendConcurrency(rawValue: string | null | undefined): number {
  const normalized = rawValue?.trim();
  if (!normalized) return DEFAULT_SEND_CONCURRENCY;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return DEFAULT_SEND_CONCURRENCY;

  return Math.max(1, Math.min(MAX_SEND_CONCURRENCY, Math.trunc(parsed)));
}
