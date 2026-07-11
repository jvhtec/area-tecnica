import { describe, expect, it } from 'vitest'

import { redactErrorText, sanitizeErrorContext } from '@/lib/errorTracking'

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

