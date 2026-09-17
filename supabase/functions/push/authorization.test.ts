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
})
