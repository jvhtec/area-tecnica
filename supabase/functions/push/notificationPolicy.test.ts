import { describe, expect, it } from 'vitest'

import {
  buildEventKey,
  categoryForEvent,
  groupingTag,
  isWithinQuietHours,
  urgencyForEvent,
} from './notificationPolicy'
import type { BroadcastBody } from './types'

const body = (type: string, extra: Partial<BroadcastBody> = {}): BroadcastBody => ({
  action: 'broadcast',
  type,
  ...extra,
})

describe('notification policy', () => {
  it('maps event families to categories and urgency', () => {
    expect(categoryForEvent('staffing.offer.sent')).toBe('staffing')
    expect(categoryForEvent('document.uploaded')).toBe('documents')
    expect(urgencyForEvent('job.status.cancelled')).toBe('urgent')
    expect(urgencyForEvent('changelog.updated')).toBe('low')
  })

  it('handles overnight quiet hours in Europe/Madrid', () => {
    expect(isWithinQuietHours('22:00', '07:00', 'Europe/Madrid', new Date('2026-01-10T22:30:00Z'))).toBe(true)
    expect(isWithinQuietHours('22:00', '07:00', 'Europe/Madrid', new Date('2026-01-10T12:00:00Z'))).toBe(false)
  })

  it('builds stable event keys and grouping tags from entity context', async () => {
    const first = body('job.updated', { job_id: 'job-1', changes: { status: { from: 'draft', to: 'confirmed' } } })
    const reordered = body('job.updated', { changes: { status: { to: 'confirmed', from: 'draft' } }, job_id: 'job-1' })
    const now = Date.parse('2026-09-17T10:02:00Z')
    expect(await buildEventKey(first, now)).toBe(await buildEventKey(reordered, now))
    expect(await buildEventKey(first, now)).not.toBe(await buildEventKey(first, now + 5 * 60 * 1000))
    expect(groupingTag(first.type, first)).toBe('jobs:job:job-1')
  })
})
