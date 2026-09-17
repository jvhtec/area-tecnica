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

  it('does not treat a domain event id as a permanent dedupe key', async () => {
    const now = Date.parse('2026-09-17T10:02:00Z')
    const firstUpdate = body('logistics.event.updated', {
      event_id: 'logistics-event-1',
      changes: { event_time: { from: '08:00', to: '09:00' } },
    })
    const secondUpdate = body('logistics.event.updated', {
      event_id: 'logistics-event-1',
      changes: { event_time: { from: '09:00', to: '10:00' } },
    })

    expect(await buildEventKey(firstUpdate, now)).not.toBe(await buildEventKey(secondUpdate, now))
    expect(await buildEventKey(firstUpdate, now)).toBe(await buildEventKey(firstUpdate, now))
    expect(groupingTag(firstUpdate.type, firstUpdate)).toBe('logistics:event:logistics-event-1')
  })

  it('keeps scheduled occurrence ids stable across retries', async () => {
    const scheduled = body('daily.morning.summary', {
      event_id: '2026-09-17:08:45:00',
      recipient_id: 'user-1',
      target_date: '2026-09-17',
    })

    expect(await buildEventKey(scheduled, Date.parse('2026-09-17T06:45:00Z')))
      .toBe('daily.morning.summary:2026-09-17:08:45:00')
    expect(await buildEventKey(scheduled, Date.parse('2026-09-17T07:10:00Z')))
      .toBe('daily.morning.summary:2026-09-17:08:45:00')
  })
})

describe('policy coverage for the newer event families', () => {
  it('files money movements under their own category', () => {
    expect(categoryForEvent('expense.submitted')).toBe('finance')
    expect(categoryForEvent('expense.approved')).toBe('finance')
    expect(categoryForEvent('payout.override.applied')).toBe('finance')
  })

  it('keeps the remaining new families in a sensible category', () => {
    expect(categoryForEvent('vacation.request.submitted')).toBe('staffing')
    expect(categoryForEvent('job.producer.claimed')).toBe('jobs')
    expect(categoryForEvent('logistics.transport.status.changed')).toBe('logistics')
    expect(categoryForEvent('soundvision.access.requested')).toBe('documents')
    expect(categoryForEvent('announcement.published')).toBe('system')
    expect(categoryForEvent('bug.report.resolved')).toBe('system')
    expect(categoryForEvent('timesheet.reminder.due')).toBe('timesheets')
  })

  it('treats a transport change as urgent so it bypasses quiet hours', () => {
    expect(urgencyForEvent('logistics.transport.status.changed')).toBe('urgent')
  })

  it('does not let routine campaign or bug traffic interrupt anyone', () => {
    expect(urgencyForEvent('staffing.campaign.completed')).toBe('low')
    expect(urgencyForEvent('bug.report.resolved')).toBe('low')
  })

  it('separates two expenses on one job instead of deduping them together', async () => {
    const base = { action: 'broadcast', type: 'expense.submitted', job_id: 'job-1' } as const
    const first = await buildEventKey({ ...base, expense_id: 'exp-1' } as never, 0)
    const second = await buildEventKey({ ...base, expense_id: 'exp-2' } as never, 0)
    expect(first).not.toBe(second)
  })

  it('still groups an expense event under its own entity', () => {
    expect(groupingTag('expense.submitted', {
      action: 'broadcast', type: 'expense.submitted', job_id: 'job-1', expense_id: 'exp-1',
    } as never)).toBe('finance:expense:exp-1')
  })
})
