import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendWeb = vi.hoisted(() => vi.fn())
const sendNative = vi.hoisted(() => vi.fn())

vi.mock('./webpush.ts', () => ({ sendPushNotification: sendWeb }))
vi.mock('./apns.ts', () => ({ sendNativePushNotification: sendNative }))

import { handleSubscribe, handleSubscribeNative } from './subscriptions'

function ownershipClient(ownerId: string | null) {
  const insert = vi.fn(async () => ({ error: null }))
  const updateEqUser = vi.fn(async () => ({ error: null }))
  const updateEqTarget = vi.fn(() => ({ eq: updateEqUser }))
  const update = vi.fn(() => ({ eq: updateEqTarget }))
  const maybeSingle = vi.fn(async () => ({
    data: ownerId ? { user_id: ownerId } : null,
    error: null,
  }))
  const selectEq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq: selectEq }))
  const from = vi.fn(() => ({ select, insert, update }))
  return {
    client: { from } as never,
    insert,
    update,
  }
}

describe('push subscription ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a web subscription owned by another account before writing', async () => {
    const { client, insert, update } = ownershipClient('other-user')
    const response = await handleSubscribe(client, 'current-user', {
      action: 'subscribe',
      subscription: { endpoint: 'https://push.example/device', keys: { p256dh: 'key', auth: 'auth' } },
      send_welcome: false,
    }, new Request('https://sector-pro.work'))

    expect(response.status).toBe(409)
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a native token owned by another account before writing', async () => {
    const { client, insert, update } = ownershipClient('other-user')
    const response = await handleSubscribeNative(client, 'current-user', {
      action: 'subscribe_native',
      token: 'native-token',
      platform: 'ios',
      send_welcome: false,
    })

    expect(response.status).toBe(409)
    expect(insert).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('inserts a previously unseen web subscription without an ownership-changing upsert', async () => {
    const { client, insert, update } = ownershipClient(null)
    const response = await handleSubscribe(client, 'current-user', {
      action: 'subscribe',
      subscription: { endpoint: 'https://push.example/new-device', keys: { p256dh: 'key', auth: 'auth' } },
      send_welcome: false,
    }, new Request('https://sector-pro.work'))

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })
})
