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

vi.mock('@/stores/useHapticsPreferencesStore', () => ({
  useHapticsPreferencesStore: {
    getState: () => mockStoreState,
  },
}))

const setNavigator = (value?: Navigator) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

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
    mockStoreState.hapticsEnabled = true
    mockStoreState.hapticsIntensity = 'light'
    setMatchMedia(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockCapacitor.isNativePlatform.mockReturnValue(false)
    setNavigator(undefined)
  })

  it('uses native haptics plugin when available on native platform', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.success()).resolves.toBe(true)
    expect(mockHaptics.notification).toHaveBeenCalledWith({ type: 'SUCCESS' })
  })

  it('uses web vibration fallback when native is unavailable', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    setNavigator({ vibrate } as unknown as Navigator)

    const { haptics, HAPTIC_PATTERNS, HapticEvent } = await import('@/lib/haptics')

    await expect(haptics.warning()).resolves.toBe(true)
    expect(vibrate).toHaveBeenCalledWith(expect.any(Array))
    const expectedBase = HAPTIC_PATTERNS[HapticEvent.Warning] as number[]
    expect((vibrate.mock.calls[0]?.[0] as number[])[0]).toBeLessThanOrEqual(expectedBase[0])
  })

  it('returns false safely when haptics are unsupported', async () => {
    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    await expect(haptics.selectionChanged()).resolves.toBe(false)
  })

  it('short-circuits when user has disabled haptics', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    setNavigator({ vibrate } as unknown as Navigator)
    mockStoreState.hapticsEnabled = false

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('respects reduced motion preference', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    setNavigator({ vibrate } as unknown as Navigator)
    setMatchMedia(true)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('rate-limits rapid interaction events and dedupes same event bursts', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    setNavigator({ vibrate } as unknown as Navigator)

    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1060)
      .mockReturnValueOnce(1220)

    const { haptics } = await import('@/lib/haptics')

    await expect(haptics.tap()).resolves.toBe(true)
    await expect(haptics.tap()).resolves.toBe(false)
    await expect(haptics.tap()).resolves.toBe(true)

    expect(vibrate).toHaveBeenCalledTimes(2)
  })

  it('applies stricter throttling to interaction events than confirmation events', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    setNavigator({ vibrate } as unknown as Navigator)

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

    expect(vibrate).toHaveBeenCalledTimes(3)
  })

  it('swallows plugin errors so UI interactions never throw', async () => {
    mockCapacitor.isNativePlatform.mockReturnValue(true)
    mockHaptics.impact.mockRejectedValueOnce(new Error('native failure'))

    const { triggerHaptic, HapticEvent } = await import('@/lib/haptics')

    await expect(triggerHaptic(HapticEvent.Tap)).resolves.toBe(false)
  })
})
