import { beforeEach, describe, expect, it, vi } from 'vitest'

type ErrorInsertPayload = {
  error_message: string
  error_type: string
  context: {
    errorStack?: string
    runtime?: { host: string; mode: string; version: string }
    [key: string]: unknown
  }
}

const insertMock = vi.hoisted(() =>
  vi.fn((_payload: ErrorInsertPayload) => Promise.resolve({ error: null })),
)

const lastInsertedPayload = (): ErrorInsertPayload => {
  const call = insertMock.mock.calls.at(-1)
  if (!call) throw new Error('Expected an error tracking insert')
  return call[0]
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}))

import {
  redactErrorText,
  resetUnhandledErrorBudget,
  sanitizeErrorContext,
  trackError,
  trackUnhandledError,
} from '@/lib/errorTracking'

describe('error tracking redaction', () => {
  it('redacts sensitive fields recursively and bounds large collections', () => {
    const sanitized = sanitizeErrorContext({
      system: 'timesheets',
      operation: 'save',
      email: 'person@example.com',
      nested: { accessToken: 'secret', safeCount: 3 },
      values: Array.from({ length: 30 }, (_, index) => index),
    })

    expect(sanitized.email).toBe('[REDACTED]')
    expect(sanitized.nested).toEqual({ accessToken: '[REDACTED]', safeCount: 3 })
    expect(sanitized.values).toHaveLength(25)
  })

  it('removes emails and query-bearing URLs from messages', () => {
    expect(redactErrorText('Failure for person@example.com at https://example.com/file?token=abc')).toBe(
      'Failure for [REDACTED_EMAIL] at [REDACTED_URL]',
    )
  })
})

describe('free-form secret redaction', () => {
  // These cases exist because this PR turns arbitrary uncaught browser
  // exceptions into persisted telemetry. Before that, redaction only had to
  // cope with strings a developer chose to pass.

  it('redacts a JWT wherever it appears', () => {
    // Assemble the fixture at runtime so the repository never contains a
    // complete JWT-shaped string that secret scanners could mistake for a key.
    const jwt = [
      'eyJhbGciOiJIUzI1NiJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
    ].join('.')

    expect(redactErrorText(`request failed with ${jwt}`)).toBe(
      'request failed with [REDACTED_TOKEN]',
    )
  })

  it('redacts a bearer credential in free text', () => {
    expect(redactErrorText('401 from Authorization: Bearer sk_live_abcdef123456789')).toBe(
      '401 from Authorization: [REDACTED_TOKEN]',
    )
  })

  it('redacts a root-relative URL carrying a query string', () => {
    expect(redactErrorText('navigation to /callback?token=abc123 failed')).toBe(
      'navigation to [REDACTED_URL] failed',
    )
  })

  it('leaves a relative path with no query string alone', () => {
    // Over-redaction costs debuggability; a bare route is the most useful part
    // of many error messages.
    expect(redactErrorText('render failed at /dashboard/jobs')).toBe(
      'render failed at /dashboard/jobs',
    )
  })

  it('redacts a token embedded in an absolute URL', () => {
    const redacted = redactErrorText('GET https://example.com/x?access_token=abc123def456 failed')

    expect(redacted).not.toContain('abc123def456')
  })

  it('still truncates to 500 characters after redaction', () => {
    expect(redactErrorText('x'.repeat(900))).toHaveLength(500)
  })
})

describe('unhandled error budget', () => {
  beforeEach(() => {
    resetUnhandledErrorBudget()
    insertMock.mockClear()
  })

  it('reports the first occurrence of an error', () => {
    expect(trackUnhandledError(new Error('boom'), { system: 'ui', operation: 'window.error' })).toBe(true)
  })

  it('reports an identical error only once', () => {
    trackUnhandledError(new Error('boom'), { system: 'ui', operation: 'window.error' })

    expect(trackUnhandledError(new Error('boom'), { system: 'ui', operation: 'window.error' })).toBe(false)
  })

  it('still reports a different error after one has been seen', () => {
    trackUnhandledError(new Error('boom'), { system: 'ui', operation: 'window.error' })

    expect(trackUnhandledError(new Error('other'), { system: 'ui', operation: 'window.error' })).toBe(true)
  })

  it('caps a storm of distinct errors at the per-page budget', () => {
    const accepted = Array.from({ length: 40 }, (_, index) =>
      trackUnhandledError(new Error(`distinct-${index}`), { system: 'ui', operation: 'window.error' }),
    ).filter(Boolean)

    expect(accepted).toHaveLength(10)
  })

  it('treats the same message from different systems as distinct', () => {
    trackUnhandledError(new Error('boom'), { system: 'ui', operation: 'window.error' })

    expect(trackUnhandledError(new Error('boom'), { system: 'jobs', operation: 'window.error' })).toBe(true)
  })

  it('redacts access-token credentials outside a URL', () => {
    expect(redactErrorText('refresh_token=abcdef1234567890 expired')).toBe(
      '[REDACTED_TOKEN] expired',
    )
  })

  it('redacts sensitive keys from non-Error rejection objects', async () => {
    trackUnhandledError(
      { token: 'short-private-value', safeCode: 503 },
      { system: 'ui', operation: 'unhandledrejection' },
    )

    await vi.waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    const payload = lastInsertedPayload()
    expect(payload.error_message).toBe('{"token":"[REDACTED]","safeCode":503}')
    expect(payload.error_message).not.toContain('short-private-value')
  })

  it('preserves useful fields from DOMException-like rejection values', async () => {
    trackUnhandledError(
      { name: 'AbortError', message: 'Request was aborted', stack: 'AbortError: Request was aborted' },
      { system: 'ui', operation: 'unhandledrejection' },
    )

    await vi.waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1))
    const payload = lastInsertedPayload()
    expect(payload.error_type).toBe('AbortError')
    expect(payload.error_message).toBe('Request was aborted')
    expect(payload.context.errorStack).toBe('AbortError: Request was aborted')
  })

  it('redacts and bounds a custom Error name before persistence', async () => {
    const error = new Error('request failed')
    error.name = `token=${'a'.repeat(200)}`

    await trackError(error, { system: 'ui', operation: 'window.error' })

    const payload = lastInsertedPayload()
    expect(payload.error_type).toBe('[REDACTED_TOKEN]')
    expect(payload.error_type.length).toBeLessThanOrEqual(120)
  })

  it('persists a sanitized stack and runtime metadata in context', async () => {
    const error = new Error('boom')
    error.stack = 'Error: boom\n at /callback?token=secret-value'

    await trackError(error, { system: 'ui', operation: 'window.error' })

    const payload = lastInsertedPayload()
    expect(payload.context.errorStack).toBe('Error: boom\n at [REDACTED_URL]')
    if (typeof window !== 'undefined') {
      expect(payload.context.runtime.host).toBe(window.location.host)
      expect(payload.context.runtime.mode).toEqual(expect.any(String))
    }
  })
})
