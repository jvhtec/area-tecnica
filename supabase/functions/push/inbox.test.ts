import { describe, expect, it, vi } from 'vitest'

import { claimInboxItems } from './inbox'
import type { BroadcastBody, PushPayload } from './types'

const body: BroadcastBody = { action: 'broadcast', type: 'daily.morning.summary' }
const payload: PushPayload = { title: 'Resumen', body: 'Contenido', url: '/morning-summary', type: body.type }

function inboxClient(insertedRows: Array<{ id: string; user_id: string }>, retryableRows = insertedRows) {
  const insertedReturns = vi.fn(async () => ({ data: insertedRows, error: null }))
  const retryableReturns = vi.fn(async () => ({ data: retryableRows, error: null }))
  const retryableStatusIn = vi.fn(() => ({ returns: retryableReturns }))
  const retryableUserIn = vi.fn(() => ({ in: retryableStatusIn }))
  const retryableEq = vi.fn(() => ({ in: retryableUserIn }))
  const from = vi.fn()
    .mockReturnValueOnce({
      upsert: () => ({ select: () => ({ returns: insertedReturns }) }),
    })
    .mockReturnValueOnce({
      select: () => ({ eq: retryableEq }),
    })
  return { client: { from } as never, from, retryableReturns }
}

describe('notification inbox claims', () => {
  it('returns only rows inserted by a normal broadcast', async () => {
    const { client, from, retryableReturns } = inboxClient([{ id: 'new-inbox', user_id: 'user-1' }])

    const claimed = await claimInboxItems(client, ['user-1'], 'event-key', body, payload, 'normal')

    expect(claimed).toEqual(new Map([['user-1', 'new-inbox']]))
    expect(from).toHaveBeenCalledOnce()
    expect(retryableReturns).not.toHaveBeenCalled()
  })

  it('reclaims failed or pending rows for a leased scheduled retry', async () => {
    const { client, from, retryableReturns } = inboxClient([], [{ id: 'failed-inbox', user_id: 'user-1' }])

    const claimed = await claimInboxItems(client, ['user-1'], 'event-key', body, payload, 'normal', true)

    expect(claimed).toEqual(new Map([['user-1', 'failed-inbox']]))
    expect(from).toHaveBeenCalledTimes(2)
    expect(retryableReturns).toHaveBeenCalledOnce()
  })
})
