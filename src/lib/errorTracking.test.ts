import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}))

import {
  redactErrorText,
  resetUnhandledErrorBudget,
  sanitizeErrorContext,
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
})
