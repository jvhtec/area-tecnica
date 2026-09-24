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

describe('logistics driver events', () => {
  function clientFor(role: string, assignmentDriverId: string | null) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => table === 'transport_driver_assignments'
              ? { data: assignmentDriverId ? { driver_id: assignmentDriverId } : null, error: null }
              : { data: { role, department: 'logistics' }, error: null },
          }),
        }),
      }),
    } as never
  }

  it('lets a driver confirm or decline only their own assignment', async () => {
    for (const type of ['logistics.driver.confirmed', 'logistics.driver.declined']) {
      await expect(authorizeBroadcast(
        clientFor('conductor', 'driver-1'),
        { userId: 'driver-1', isService: false },
        body(type, { assignment_id: 'a-1' }),
      )).resolves.toBeUndefined()

      await expect(authorizeBroadcast(
        clientFor('conductor', 'driver-2'),
        { userId: 'driver-1', isService: false },
        body(type, { assignment_id: 'a-1' }),
      )).rejects.toMatchObject({ status: 403 })
    }
  })

  it('keeps assignment announcements to admin and management', async () => {
    for (const type of ['logistics.driver.assigned', 'logistics.driver.updated', 'logistics.driver.removed']) {
      await expect(authorizeBroadcast(
        clientFor('management', null),
        { userId: 'manager', isService: false },
        body(type, { assignment_id: 'a-1' }),
      )).resolves.toBeUndefined()

      // The logistics role may emit other logistics.* events, but cannot pick a
      // driver to tell that their transport was removed.
      for (const role of ['logistics', 'conductor', 'house_tech']) {
        await expect(authorizeBroadcast(
          clientFor(role, 'caller'),
          { userId: 'caller', isService: false },
          body(type, { assignment_id: 'a-1', recipient_id: 'driver-9' }),
        )).rejects.toMatchObject({ status: 403 })
      }
    }
  })
})
