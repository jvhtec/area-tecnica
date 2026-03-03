import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
}))

const mockHaptics = vi.hoisted(() => ({
  impact: vi.fn().mockResolvedValue(undefined),
  notification: vi.fn().mockResolvedValue(undefined),
  selectionChanged: vi.fn().mockResolvedValue(undefined),
}))

const mockStoreState = vi.hoisted(() => ({
  hapticsEnabled: true,
  hapticsIntensity: 'light' as const,
}))

const mockWebHaptics = vi.hoisted(() => {
  const trigger = vi.fn().mockResolvedValue(undefined)
  const constructor = vi.fn()

  class MockWebHaptics {
    static isSupported = true
    trigger = trigger

    constructor(...args: unknown[]) {
      constructor(...args)
    }
  }

  return {
    MockWebHaptics,
    trigger,
    constructor,
  }
})

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: mockHaptics,
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}))

vi.mock('web-haptics', () => ({
  WebHaptics: mockWebHaptics.MockWebHaptics,
}))

vi.mock('@/stores/useHapticsPreferencesStore', () => ({
  useHapticsPreferencesStore: {
    getState: () => mockStoreState,
  },
}))

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: vi.fn().mockReturnValue({ matches }),
    },
  })
}

describe('haptics adapter selection', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockStoreState.hapticsEnabled = true
    mockStoreState.hapticsIntensity = 'light'
    mockWebHaptics.MockWebHaptics.isSupported = true
    setMatchMedia(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    mockCapacitor.isNativePlatform.mockReturnValue(false)
    mockWebHaptics.MockWebHaptics.isSupported = true
  })

  it('prefers web-haptics on native platform when native flag is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_NATIVE_HAPTICS', 'false')
    mockCapacitor.isNativePlatform.mockReturnValue(true)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.success()).resolves.toBe(true)
    expect(mockWebHaptics.trigger).toHaveBeenCalledWith('success', { intensity: 0.4 })
    expect(mockHaptics.notification).not.toHaveBeenCalled()
  })

  it('uses native haptics when flag is enabled and web-haptics is unsupported', async () => {
    vi.stubEnv('VITE_ENABLE_NATIVE_HAPTICS', 'true')
    mockCapacitor.isNativePlatform.mockReturnValue(true)
    mockWebHaptics.MockWebHaptics.isSupported = false

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.success()).resolves.toBe(true)
    expect(mockHaptics.notification).toHaveBeenCalledWith({ type: 'SUCCESS' })
  })

  it('uses web-haptics fallback when native is unavailable', async () => {
    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.warning()).resolves.toBe(true)
    expect(mockWebHaptics.trigger).toHaveBeenCalledWith('warning', { intensity: 0.4 })
  })

  it('returns false safely when haptics are unsupported', async () => {
    mockWebHaptics.MockWebHaptics.isSupported = false
    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    await expect(haptics.selectionChanged()).resolves.toBe(false)
  })

  it('short-circuits when user has disabled haptics', async () => {
    mockStoreState.hapticsEnabled = false

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    expect(mockWebHaptics.trigger).not.toHaveBeenCalled()
  })

  it('respects reduced motion preference', async () => {
    setMatchMedia(true)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    expect(mockWebHaptics.trigger).not.toHaveBeenCalled()
  })

  it('rate-limits rapid interaction events and dedupes same event bursts', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1060)
      .mockReturnValueOnce(1220)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(true)
    await expect(haptics.tap()).resolves.toBe(false)
    await expect(haptics.tap()).resolves.toBe(true)

    expect(mockWebHaptics.trigger).toHaveBeenCalledTimes(2)
  })

  it('applies stricter throttling to interaction events than confirmation events', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2085)
      .mockReturnValueOnce(2300)
      .mockReturnValueOnce(2385)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(true)
    await expect(haptics.selectionChanged()).resolves.toBe(false)

    await expect(haptics.success()).resolves.toBe(true)
    await expect(haptics.error()).resolves.toBe(true)

    expect(mockWebHaptics.trigger).toHaveBeenCalledTimes(3)
  })

  it('swallows plugin errors so UI interactions never throw', async () => {
    vi.stubEnv('VITE_ENABLE_NATIVE_HAPTICS', 'true')
    mockCapacitor.isNativePlatform.mockReturnValue(true)
    mockWebHaptics.MockWebHaptics.isSupported = false
    mockHaptics.impact.mockRejectedValueOnce(new Error('native failure'))

    const { triggerHaptic, HapticEvent } = await import('@/lib/haptics')

    await expect(triggerHaptic(HapticEvent.Tap)).resolves.toBe(false)
  })
})
