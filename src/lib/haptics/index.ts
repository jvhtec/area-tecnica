import { Capacitor } from '@capacitor/core'

import { useHapticsPreferencesStore, type HapticsIntensity } from '@/stores/useHapticsPreferencesStore'

export enum HapticEvent {
  Tap = 'tap',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  SelectionChanged = 'selectionChanged',
}

export const HAPTIC_PATTERNS: Record<HapticEvent, number | number[]> = {
  [HapticEvent.Tap]: 10,
  [HapticEvent.Success]: [15, 35, 20],
  [HapticEvent.Warning]: [30, 40, 30],
  [HapticEvent.Error]: [45, 30, 45],
  [HapticEvent.SelectionChanged]: 8,
}

const INTENSITY_MULTIPLIER: Record<HapticsIntensity, number> = {
  light: 0.65,
  medium: 1,
  strong: 1.25,
}

type HapticRateClass = 'interaction' | 'confirmation'

const HAPTIC_RATE_CLASS_BY_EVENT: Record<HapticEvent, HapticRateClass> = {
  [HapticEvent.Tap]: 'interaction',
  [HapticEvent.SelectionChanged]: 'interaction',
  [HapticEvent.Success]: 'confirmation',
  [HapticEvent.Warning]: 'confirmation',
  [HapticEvent.Error]: 'confirmation',
}

export const HAPTIC_RATE_LIMIT_MS: Record<HapticRateClass, number> = {
  // Stricter throttling for high-frequency events.
  interaction: 160,
  // Looser throttling for user-visible success/error confirmations.
  confirmation: 80,
}

export const HAPTIC_EVENT_DEDUPE_WINDOW_MS = 220

const lastEventAt: Partial<Record<HapticEvent, number>> = {}
const lastClassAt: Partial<Record<HapticRateClass, number>> = {}

const now = () => Date.now()

const shouldEmitByRateLimit = (event: HapticEvent): boolean => {
  const currentTime = now()
  const rateClass = HAPTIC_RATE_CLASS_BY_EVENT[event]

  const previousEventAt = lastEventAt[event]
  if (typeof previousEventAt === 'number' && currentTime - previousEventAt < HAPTIC_EVENT_DEDUPE_WINDOW_MS) {
    return false
  }

  const previousClassAt = lastClassAt[rateClass]
  if (typeof previousClassAt === 'number' && currentTime - previousClassAt < HAPTIC_RATE_LIMIT_MS[rateClass]) {
    return false
  }

  lastEventAt[event] = currentTime
  lastClassAt[rateClass] = currentTime

  return true
}

const isReducedMotionPreferred = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const getHapticsPreferences = () => {
  const { hapticsEnabled, hapticsIntensity } = useHapticsPreferencesStore.getState()

  return {
    hapticsEnabled,
    hapticsIntensity,
  }
}

const isHapticsAllowed = (): boolean => {
  const { hapticsEnabled } = getHapticsPreferences()

  if (!hapticsEnabled) {
    return false
  }

  if (isReducedMotionPreferred()) {
    return false
  }

  return true
}

export const WEB_HAPTIC_STRATEGY: Record<HapticEvent, number | number[]> = {
  [HapticEvent.Tap]: HAPTIC_PATTERNS[HapticEvent.Tap],
  [HapticEvent.Success]: HAPTIC_PATTERNS[HapticEvent.Success],
  [HapticEvent.Warning]: HAPTIC_PATTERNS[HapticEvent.Warning],
  [HapticEvent.Error]: HAPTIC_PATTERNS[HapticEvent.Error],
  [HapticEvent.SelectionChanged]: HAPTIC_PATTERNS[HapticEvent.SelectionChanged],
}

type NativeHapticsPlugin = {
  impact?: (options?: { style?: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>
  notification?: (options: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>
  selectionStart?: () => Promise<void>
  selectionChanged?: () => Promise<void>
  vibrate?: (options?: { duration?: number }) => Promise<void>
}

type HapticAdapter = {
  canUse: () => boolean
  trigger: (event: HapticEvent) => Promise<boolean>
}

const applyIntensity = (pattern: number | number[], intensity: HapticsIntensity): number | number[] => {
  const multiplier = INTENSITY_MULTIPLIER[intensity]

  if (Array.isArray(pattern)) {
    return pattern.map((value) => Math.max(1, Math.round(value * multiplier)))
  }

  return Math.max(1, Math.round(pattern * multiplier))
}

const getNativeHapticsPlugin = (): NativeHapticsPlugin | null => {
  const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> })?.Plugins
  if (!plugins?.Haptics) {
    return null
  }

  return plugins.Haptics as NativeHapticsPlugin
}

const nativeAdapter: HapticAdapter = {
  canUse: () => {
    const isNativePlatform = Capacitor?.isNativePlatform?.() ?? false
    const pluginAvailable = Capacitor?.isPluginAvailable?.('Haptics') ?? false

    return isNativePlatform && pluginAvailable && !!getNativeHapticsPlugin()
  },
  trigger: async (event: HapticEvent) => {
    const { hapticsIntensity } = getHapticsPreferences()
    const plugin = getNativeHapticsPlugin()
    if (!plugin) {
      return false
    }

    if (event === HapticEvent.SelectionChanged) {
      if (plugin.selectionChanged) {
        await plugin.selectionChanged()
        return true
      }
      if (plugin.selectionStart) {
        await plugin.selectionStart()
        return true
      }
    }

    if (event === HapticEvent.Success || event === HapticEvent.Warning || event === HapticEvent.Error) {
      if (plugin.notification) {
        const typeMap = {
          [HapticEvent.Success]: 'SUCCESS',
          [HapticEvent.Warning]: 'WARNING',
          [HapticEvent.Error]: 'ERROR',
        } as const

        await plugin.notification({ type: typeMap[event] })
        return true
      }
    }

    if (plugin.impact) {
      const styleMap: Record<HapticsIntensity, { light: 'LIGHT'; medium: 'MEDIUM'; heavy: 'HEAVY' }> = {
        light: { light: 'LIGHT', medium: 'LIGHT', heavy: 'MEDIUM' },
        medium: { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' },
        strong: { light: 'MEDIUM', medium: 'HEAVY', heavy: 'HEAVY' },
      }

      const semanticStyle = {
        [HapticEvent.Tap]: 'light',
        [HapticEvent.Success]: 'medium',
        [HapticEvent.Warning]: 'heavy',
        [HapticEvent.Error]: 'heavy',
        [HapticEvent.SelectionChanged]: 'light',
      } as const

      await plugin.impact({ style: styleMap[hapticsIntensity][semanticStyle[event]] })
      return true
    }

    if (plugin.vibrate) {
      const duration = applyIntensity(HAPTIC_PATTERNS[event], hapticsIntensity)
      const ms = Array.isArray(duration) ? duration[0] : duration
      await plugin.vibrate({ duration: ms })
      return true
    }

    return false
  },
}

const webAdapter: HapticAdapter = {
  canUse: () => {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function'
  },
  trigger: async (event: HapticEvent) => {
    if (!webAdapter.canUse()) {
      return false
    }

    const { hapticsIntensity } = getHapticsPreferences()
    const pattern = applyIntensity(WEB_HAPTIC_STRATEGY[event], hapticsIntensity)
    navigator.vibrate(pattern)
    return true
  },
}

const noOpAdapter: HapticAdapter = {
  canUse: () => true,
  trigger: async () => false,
}

export const getHapticsAdapter = (): HapticAdapter => {
  if (nativeAdapter.canUse()) {
    return nativeAdapter
  }

  if (webAdapter.canUse()) {
    return webAdapter
  }

  return noOpAdapter
}

export const triggerHaptic = async (event: HapticEvent): Promise<boolean> => {
  try {
    if (!isHapticsAllowed()) {
      return false
    }

    if (!shouldEmitByRateLimit(event)) {
      return false
    }

    const adapter = getHapticsAdapter()
    return await adapter.trigger(event)
  } catch {
    return false
  }
}

export const haptics = {
  tap: () => triggerHaptic(HapticEvent.Tap),
  success: () => triggerHaptic(HapticEvent.Success),
  warning: () => triggerHaptic(HapticEvent.Warning),
  error: () => triggerHaptic(HapticEvent.Error),
  selectionChanged: () => triggerHaptic(HapticEvent.SelectionChanged),
}
