import { describe, expect, it } from 'vitest'

import { authorizeBroadcast } from './authorization'
import type { BroadcastBody } from './types'

function clientForProfile(role: string, department: string | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role, department }, error: null }),
        }),
      }),
    }),
  } as never
}

const body = (type: string, extra: Partial<BroadcastBody> = {}): BroadcastBody => ({ action: 'broadcast', type, ...extra })

describe('push broadcast authorization', () => {
  it('rejects unknown event types even for service callers', async () => {
    await expect(authorizeBroadcast(clientForProfile('admin'), { userId: 'service', isService: true }, body('invented.event')))
      .rejects.toMatchObject({ status: 400 })
  })

  it('keeps service-only events closed to management users', async () => {
    await expect(authorizeBroadcast(clientForProfile('management'), { userId: 'manager', isService: false }, body('staffing.offer.sent')))
      .rejects.toMatchObject({ status: 403 })
  })

  it('allows a technician to announce their own submitted timesheet', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('technician'),
      { userId: 'tech-1', isService: false },
      body('timesheet.submitted', { technician_id: 'tech-1' }),
    )).resolves.toBeUndefined()
  })

  it('rejects actor impersonation before delivery', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('management'),
      { userId: 'manager', isService: false },
      body('job.updated', { actor_id: 'someone-else' }),
    )).rejects.toMatchObject({ status: 403 })
  })

  it('removes caller-selected fan-out for user-originated events', async () => {
    const request = body('job.updated', { user_ids: ['unrelated-user'], actor_name: 'Nombre falso' })
    await authorizeBroadcast(clientForProfile('management'), { userId: 'manager', isService: false }, request)
    expect(request.user_ids).toBeUndefined()
    expect(request.actor_name).toBeUndefined()
    expect(request.actor_id).toBe('manager')
  })

  it('lets a technician raise their own vacation, expense and SoundVision requests', async () => {
    for (const [type, extra] of [
      ['vacation.request.submitted', { technician_id: 'tech-1' }],
      ['expense.submitted', { technician_id: 'tech-1' }],
      ['soundvision.access.requested', { technician_id: 'tech-1' }],
    ] as const) {
      await expect(authorizeBroadcast(
        clientForProfile('technician'),
        { userId: 'tech-1', isService: false },
        body(type, extra),
      )).resolves.toBeUndefined()
    }
  })

  it('stops a technician raising a self-service event on behalf of someone else', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('technician'),
      { userId: 'tech-1', isService: false },
      body('expense.submitted', { technician_id: 'tech-2' }),
    )).rejects.toMatchObject({ status: 403 })
  })

  it('keeps decision outcomes closed to the user who would benefit from them', async () => {
    for (const type of [
      'vacation.request.approved',
      'payout.override.applied',
      'bug.report.resolved',
      'timesheet.reminder.due',
      'soundvision.access.approved',
      'staffing.campaign.completed',
    ]) {
      await expect(authorizeBroadcast(
        clientForProfile('management'),
        { userId: 'manager', isService: false },
        body(type),
      )).rejects.toMatchObject({ status: 403 })
    }
  })

  it('allows management to decide an expense, matching the approve_job_expense RPC', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('management'),
      { userId: 'manager', isService: false },
      body('expense.approved', { technician_id: 'tech-1' }),
    )).resolves.toBeUndefined()
  })

  it('lets a production technician claim a job without being management', async () => {
    for (const department of ['production', 'produccion', 'producci\u00f3n']) {
      await expect(authorizeBroadcast(
        clientForProfile('technician', department),
        { userId: 'prod-1', isService: false },
        body('job.producer.claimed', { job_id: 'job-1' }),
      )).resolves.toBeUndefined()
    }
  })

  it('stops a non-production technician claiming a job', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('technician', 'sound'),
      { userId: 'tech-1', isService: false },
      body('job.producer.claimed', { job_id: 'job-1' }),
    )).rejects.toMatchObject({ status: 403 })
  })

  it('stops an ordinary user publishing a company-wide announcement', async () => {
    await expect(authorizeBroadcast(
      clientForProfile('technician', 'sound'),
      { userId: 'tech-1', isService: false },
      body('announcement.published'),
    )).rejects.toMatchObject({ status: 403 })
  })
})
