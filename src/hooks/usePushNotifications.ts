import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  disablePush,
  enablePush,
  getExistingPushSubscription,
  getPushPermissionStatus,
  isPushSupported,
  synchronizeExistingPushSubscription,
} from '@/lib/push'
import {
  disableNativePush,
  enableNativePush,
  getNativePushPermissionStatus,
  getStoredNativePushToken,
  isNativePushSupported,
  synchronizeNativePush,
} from '@/lib/push-native'

type PushState = {
  isSupported: boolean
  permission: NotificationPermission
  subscription: PushSubscription | NativePushSubscription | null
  isInitializing: boolean
  isEnabling: boolean
  isDisabling: boolean
  error: string | null
  enable: () => Promise<PushSubscription | NativePushSubscription | null>
  disable: () => Promise<void>
  synchronize: () => Promise<boolean>
  canEnable: boolean
}

type NativePushSubscription = {
  platform: 'ios'
  token: string
}

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

const getUnsupportedError = (): string =>
  'Este dispositivo no admite notificaciones push.'

const getMissingVapidKeyError = (): string =>
  'Las notificaciones web todavía no están configuradas. Contacta con administración.'

export const usePushNotifications = (): PushState => {
  const isNative = useMemo(() => isNativePushSupported(), [])
  const [subscription, setSubscription] = useState<PushSubscription | NativePushSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(getPushPermissionStatus())
  const [isInitializing, setIsInitializing] = useState<boolean>(isPushSupported() || isNative)
  const [isEnabling, setIsEnabling] = useState<boolean>(false)
  const [isDisabling, setIsDisabling] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => (isNative ? true : isPushSupported()), [isNative])
  const hasVapidKey = Boolean(vapidPublicKey)

  useEffect(() => {
    let cancelled = false

    if (!supported) {
      setError(getUnsupportedError())
      setIsInitializing(false)
      return () => {
        cancelled = true
      }
    }

    if (!isNative && !hasVapidKey) {
      setError(getMissingVapidKeyError())
    }

    const loadExistingSubscription = async () => {
      setIsInitializing(true)
      try {
        if (isNative) {
          const existingToken = getStoredNativePushToken()
          const nativePermission = await getNativePushPermissionStatus()
          if (!cancelled) {
            setSubscription(
              existingToken ? { platform: 'ios', token: existingToken } : null
            )
            setPermission(nativePermission)
          }
        } else {
          const existing = await getExistingPushSubscription()
          if (!cancelled) {
            setSubscription(existing)
            setPermission(getPushPermissionStatus())
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load push subscription', err)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo comprobar la suscripción existente.'
          )
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    void loadExistingSubscription()

    return () => {
      cancelled = true
    }
  }, [supported, hasVapidKey, isNative])

  const enable = useCallback(async () => {
    if (!supported) {
      const message = getUnsupportedError()
      setError(message)
      throw new Error(message)
    }

    if (!isNative && !vapidPublicKey) {
      const message = getMissingVapidKeyError()
      setError(message)
      throw new Error(message)
    }

    setIsEnabling(true)
    setError(null)

    try {
      if (isNative) {
        const token = await enableNativePush()
        const nativePermission = await getNativePushPermissionStatus()
        setPermission(nativePermission)

        if (token) {
          const nativeSubscription: NativePushSubscription = { platform: 'ios', token }
          setSubscription(nativeSubscription)
          console.log('✅ Native push registration successful.')
          return nativeSubscription
        }

        console.warn('⚠️ Native push permission denied or registration failed')
        return null
      }

      const nextSubscription = await enablePush(vapidPublicKey as string)
      setPermission(getPushPermissionStatus())

      if (nextSubscription) {
        setSubscription(nextSubscription)
        console.log('✅ Push subscription successful. You should receive a welcome notification.')
      } else {
        console.warn('⚠️ Push permission denied or subscription failed')
      }

      return nextSubscription
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudieron activar las notificaciones.'
      console.error('❌ Push enable error:', err)
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsEnabling(false)
    }
  }, [supported, isNative])

  const disable = useCallback(async () => {
    if (!supported) {
      const message = getUnsupportedError()
      setError(message)
      throw new Error(message)
    }

    setIsDisabling(true)
    setError(null)

    try {
      if (isNative) {
        await disableNativePush()
        setSubscription(null)
        setPermission(await getNativePushPermissionStatus())
        return
      }

      await disablePush()
      setSubscription(null)
      setPermission(getPushPermissionStatus())
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudieron desactivar las notificaciones.'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsDisabling(false)
    }
  }, [supported, isNative])

  const synchronize = useCallback(async () => {
    if (!subscription) return false
    setError(null)
    try {
      return isNative
        ? await synchronizeNativePush()
        : await synchronizeExistingPushSubscription()
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'No se pudo sincronizar este dispositivo.'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }, [isNative, subscription])

  const canEnable =
    supported &&
    (isNative || hasVapidKey) &&
    !subscription &&
    permission !== 'denied'

  return {
    isSupported: supported,
    permission,
    subscription,
    isInitializing,
    isEnabling,
    isDisabling,
    error,
    enable,
    disable,
    synchronize,
    canEnable
  }
}
