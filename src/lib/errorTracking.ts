import { supabase } from '@/lib/supabase'

/**
 * Subsystems permitted to report through `trackError` — the single source of
 * truth for that allowlist.
 *
 * This is a value, not just a type, so the contract can be *checked* rather
 * than remembered. The same list is duplicated by necessity in two SQL files
 * (the migration that defines the CHECK constraint, and the pgTAP test that
 * verifies the live database matches it), and SQL cannot import TypeScript.
 * `src/lib/__tests__/systemNames.contract.test.ts` closes that loop by parsing
 * both SQL files and asserting they equal this array, so drift in any of the
 * three copies fails in CI rather than at INSERT time in production.
 *
 * Adding a name here therefore requires a migration too — and the contract test
 * will tell you so.
 */
export const SYSTEM_NAMES = [
  'timesheets',
  'assignments',
  'ui',
  'auth',
  'jobs',
  'tours',
  'festivals',
  'staffing',
  'equipment',
  'logistics',
  'documents',
  'flex',
] as const

export type SystemName = (typeof SYSTEM_NAMES)[number]

export interface ErrorTrackingContext {
  system: SystemName
  operation: string
  userId?: string | null
  [key: string]: unknown
}

const REDACTED_CONTEXT_KEYS = /(?:authorization|password|token|secret|api.?key|cookie|email|phone|dni|address|signed.?url|body|payload)/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi

/**
 * Free-form secret patterns.
 *
 * These matter more than they used to. Redaction was written when `trackError`
 * had a handful of deliberate call sites, where the author chose what to pass.
 * The global handlers and the error boundary now persist *arbitrary* uncaught
 * exception text, which routinely carries whatever a failing request was
 * holding — a `fetch` rejection quoting a URL, a library error echoing an
 * `Authorization` header. Nobody curates that string, so the patterns have to.
 *
 * Order matters below: bearer/JWT run before the URL rules so a token inside a
 * URL is not merely swallowed by the coarser `[REDACTED_URL]` replacement.
 */
// `Bearer <token>` / `token=<value>` style credentials in free text.
const BEARER_PATTERN = /\b(?:bearer|token|access[-_]?token|refresh[-_]?token|api[-_]?key|secret)(?:\s*[:=]\s*|\s+)[A-Za-z0-9._~+/=-]{12,}/gi
// Three base64url segments — a JWT, however it was embedded.
const JWT_PATTERN = /\beyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{5,}/g
// Absolute URLs carrying a query string.
const URL_QUERY_PATTERN = /https?:\/\/[^\s?]+\?[^\s]+/gi
// Root-relative paths carrying a query string — `/callback?token=abc`. Just as
// capable of holding a one-time code, and previously not redacted at all.
const RELATIVE_URL_QUERY_PATTERN = /(?:^|[\s"'(<])(\/[A-Za-z0-9._~\-/]*\?[^\s"')>]+)/g

export const redactErrorText = (value: string): string => value
  .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
  .replace(JWT_PATTERN, '[REDACTED_TOKEN]')
  .replace(BEARER_PATTERN, '[REDACTED_TOKEN]')
  .replace(URL_QUERY_PATTERN, '[REDACTED_URL]')
  .replace(RELATIVE_URL_QUERY_PATTERN, (match, path: string) =>
    match.slice(0, match.length - path.length) + '[REDACTED_URL]')
  .slice(0, 500)

const sanitizeValue = (value: unknown, key?: string, depth = 0): unknown => {
  if (key && REDACTED_CONTEXT_KEYS.test(key)) return '[REDACTED]'
  if (depth > 4) return '[MAX_DEPTH]'
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return { name: value.name, message: redactErrorText(value.message) }
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, undefined, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childValue, childKey, depth + 1),
    ]))
  }
  if (typeof value === 'string') return redactErrorText(value)
  return typeof value === 'bigint' ? value.toString() : value
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  try {
    // DOMException and errors from another JavaScript realm are often not
    // `instanceof Error`, while their useful fields are non-enumerable and
    // would otherwise collapse to `{}` when stringified.
    if (error && typeof error === 'object') {
      const errorLike = error as { message?: unknown; name?: unknown; stack?: unknown }
      if (typeof errorLike.message === 'string') {
        const normalized = new Error(errorLike.message)
        if (typeof errorLike.name === 'string') normalized.name = errorLike.name
        if (typeof errorLike.stack === 'string') normalized.stack = errorLike.stack
        return normalized
      }
    }

    const serialized = JSON.stringify(sanitizeValue(error))
    return new Error(serialized ?? String(error))
  } catch {
    return new Error('Unknown error')
  }
}

const safeErrorName = (error: Error): string =>
  redactErrorText(error.name || 'Error').slice(0, 120)

export const sanitizeErrorContext = (context: ErrorTrackingContext) => sanitizeValue(context) as Record<string, unknown>

export const trackError = async (error: unknown, context: ErrorTrackingContext) => {
  const normalized = normalizeError(error)
  const errorName = safeErrorName(normalized)
  const payloadContext = sanitizeErrorContext({
    ...context,
    errorStack: normalized.stack,
    runtime: typeof window === 'undefined' ? undefined : {
      host: window.location.host,
      mode: import.meta.env.MODE,
      version: import.meta.env.VITE_APP_VERSION || 'unknown',
    },
  })
  const safeUserId = typeof context.userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.userId)
    ? context.userId
    : null

  try {
    const { error: dbError } = await supabase.from('system_errors').insert({
      system: context.system,
      error_type: errorName,
      error_message: redactErrorText(normalized.message),
      context: payloadContext,
      user_id: safeUserId,
    })
    if (dbError) {
      throw dbError
    }
  } catch (loggingError) {
    console.error('[monitoring] Failed to record error context', loggingError)
  } finally {
    console.error(`[${context.system}] ${context.operation}:`, {
      name: errorName,
      message: redactErrorText(normalized.message),
    })
  }
}

/**
 * Per-page-load budget for unhandled errors.
 *
 * A render loop or a repeatedly-failing poller can raise the same error
 * thousands of times a minute. Without a cap, wiring the global handlers to
 * this sink would turn a client-side bug into a write storm against
 * `system_errors` and bury the distinct failures worth reading. Identical
 * errors are therefore reported once, and the whole page load is capped.
 */
const UNHANDLED_REPORT_BUDGET = 10

let unhandledReportsSent = 0
const reportedSignatures = new Set<string>()

/** Test seam: restores the budget between cases. */
export const resetUnhandledErrorBudget = () => {
  unhandledReportsSent = 0
  reportedSignatures.clear()
}

/**
 * Report an error that reached a global handler rather than a `catch`.
 *
 * Deduplicated and budgeted, unlike `trackError`, which callers invoke at a
 * known site and are expected to rate-limit themselves. Returns whether the
 * report was actually forwarded, which is what the tests assert on.
 */
export const trackUnhandledError = (
  error: unknown,
  context: ErrorTrackingContext,
): boolean => {
  const normalized = normalizeError(error)
  const signature = `${context.system}:${safeErrorName(normalized)}:${redactErrorText(normalized.message)}`

  if (reportedSignatures.has(signature)) return false
  if (unhandledReportsSent >= UNHANDLED_REPORT_BUDGET) return false

  reportedSignatures.add(signature)
  unhandledReportsSent += 1

  // Fire and forget: a global handler must not await, and `trackError` already
  // swallows every failure of its own.
  void trackError(normalized, context)
  return true
}
