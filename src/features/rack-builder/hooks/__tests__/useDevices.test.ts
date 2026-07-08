import { describe, expect, it, vi } from 'vitest'
import { getDeviceImageUrl } from '../useDevices'

const mocks = vi.hoisted(() => {
  const publicUrlForPath = vi.fn((path: string) => ({
    data: {
      publicUrl: `https://example.test/storage/${path}`,
    },
  }))
  return {
    publicUrlForPath,
    fromBucket: vi.fn(() => ({
      getPublicUrl: publicUrlForPath,
    })),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: mocks.fromBucket,
    },
  },
}))

describe('getDeviceImageUrl', () => {
  it('preserves generated data URLs used by rack builder thumbnails', () => {
    const dataUrl = 'data:image/svg+xml;utf8,%3Csvg%20/%3E'

    expect(getDeviceImageUrl(dataUrl)).toBe(dataUrl)
    expect(mocks.fromBucket).not.toHaveBeenCalled()
  })

  it('resolves storage paths through the rack builder device image bucket', () => {
    expect(getDeviceImageUrl('front/device.jpg')).toBe('https://example.test/storage/front/device.jpg')
    expect(mocks.fromBucket).toHaveBeenCalledWith('rack-builder-device-images')
  })
})
