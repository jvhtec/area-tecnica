import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { WebHaptics } from 'web-haptics'

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

type HapticRateClass = 'interaction' | 'confirmation'

const HAPTIC_RATE_CLASS_BY_EVENT: Record<HapticEvent, HapticRateClass> = {
  [HapticEvent.Tap]: 'interaction',
  [HapticEvent.SelectionChanged]: 'interaction',
  [HapticEvent.Success]: 'confirmation',
  [HapticEvent.Warning]: 'confirmation',
  [HapticEvent.Error]: 'confirmation',
}

export const HAPTIC_RATE_LIMIT_MS: Record<HapticRateClass, number> = {
  interaction: 160,
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

type HapticAdapter = {
  canUse: () => boolean
  trigger: (event: HapticEvent) => Promise<boolean>
}

type HapticStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY'

const isNativeHapticsEnabled = (): boolean => {
  return import.meta.env.VITE_ENABLE_NATIVE_HAPTICS === 'true'
}

const isWebHapticsDebugEnabled = (): boolean => {
  return import.meta.env.VITE_WEB_HAPTICS_DEBUG === 'true'
}

let webHapticsClient: WebHaptics | null | undefined

const getWebHapticsClient = (): WebHaptics | null => {
  if (typeof window === 'undefined') {
    return null
  }

  if (webHapticsClient !== undefined) {
    return webHapticsClient
  }

  webHapticsClient = new WebHaptics({
    debug: isWebHapticsDebugEnabled(),
    showSwitch: false,
  })

  return webHapticsClient
}

const nativeAdapter: HapticAdapter = {
  canUse: () => {
    if (!isNativeHapticsEnabled()) {
      return false
    }

    const isNativePlatform = Capacitor?.isNativePlatform?.() ?? false

    return isNativePlatform && Boolean(Haptics)
  },
  trigger: async (event: HapticEvent) => {
    const { hapticsIntensity } = getHapticsPreferences()

    if (event === HapticEvent.SelectionChanged) {
      await Haptics.selectionChanged()
      return true
    }

    if (event === HapticEvent.Success || event === HapticEvent.Warning || event === HapticEvent.Error) {
      const typeMap = {
        [HapticEvent.Success]: NotificationType.Success,
        [HapticEvent.Warning]: NotificationType.Warning,
        [HapticEvent.Error]: NotificationType.Error,
      } as const

      await Haptics.notification({ type: typeMap[event] })
      return true
    }

    const styleMap: Record<HapticsIntensity, { light: HapticStyle; medium: HapticStyle; heavy: HapticStyle }> = {
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

    const impactStyleMap: Record<HapticStyle, ImpactStyle> = {
      LIGHT: ImpactStyle.Light,
      MEDIUM: ImpactStyle.Medium,
      HEAVY: ImpactStyle.Heavy,
    }

    await Haptics.impact({ style: impactStyleMap[styleMap[hapticsIntensity][semanticStyle[event]]] })
    return true
  },
}

const webAdapter: HapticAdapter = {
  canUse: () => {
    const client = getWebHapticsClient()
    if (!client) {
      return false
    }

    return WebHaptics.isSupported || isWebHapticsDebugEnabled()
  },
  trigger: async (event: HapticEvent) => {
    if (!webAdapter.canUse()) {
      return false
    }

    const client = getWebHapticsClient()
    if (!client) {
      return false
    }

    const eventMap: Record<HapticEvent, 'light' | 'selection' | 'success' | 'warning' | 'error'> = {
      [HapticEvent.Tap]: 'light',
      [HapticEvent.SelectionChanged]: 'selection',
      [HapticEvent.Success]: 'success',
      [HapticEvent.Warning]: 'warning',
      [HapticEvent.Error]: 'error',
    }
    const intensityMap: Record<HapticsIntensity, number> = {
      light: 0.4,
      medium: 0.7,
      strong: 1,
    }
    const { hapticsIntensity } = getHapticsPreferences()
    await client.trigger(eventMap[event], { intensity: intensityMap[hapticsIntensity] })
    return true
  },
}

const noOpAdapter: HapticAdapter = {
  canUse: () => true,
  trigger: async () => false,
}

export const getHapticsAdapter = (): HapticAdapter => {
  if (webAdapter.canUse()) {
    return webAdapter
  }

  if (nativeAdapter.canUse()) {
    return nativeAdapter
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
