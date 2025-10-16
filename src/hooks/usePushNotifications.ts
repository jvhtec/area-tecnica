import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  disablePush,
  enablePush,
  getExistingPushSubscription,
  getPushPermissionStatus,
  isPushSupported
} from '@/lib/push'

type PushState = {
  isSupported: boolean
  permission: NotificationPermission
  subscription: PushSubscription | null
  isInitializing: boolean
  isEnabling: boolean
  isDisabling: boolean
  error: string | null
  enable: () => Promise<PushSubscription | null>
  disable: () => Promise<void>
  canEnable: boolean
}

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

const getUnsupportedError = (): string =>
  'Push notifications are not supported in this browser.'

const getMissingVapidKeyError = (): string =>
  'VITE_VAPID_PUBLIC_KEY is not configured. Ask an administrator to set it before enabling push notifications.'

export const usePushNotifications = (): PushState => {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>(getPushPermissionStatus())
  const [isInitializing, setIsInitializing] = useState<boolean>(isPushSupported())
  const [isEnabling, setIsEnabling] = useState<boolean>(false)
  const [isDisabling, setIsDisabling] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const supported = useMemo(() => isPushSupported(), [])
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

    if (!hasVapidKey) {
      setError(getMissingVapidKeyError())
    }

    const loadExistingSubscription = async () => {
      setIsInitializing(true)
      try {
        const existing = await getExistingPushSubscription()
        if (!cancelled) {
          setSubscription(existing)
          setPermission(getPushPermissionStatus())
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load push subscription', err)
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load the existing push subscription.'
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
  }, [supported, hasVapidKey])

  const enable = useCallback(async () => {
    if (!supported) {
      const message = getUnsupportedError()
      setError(message)
      throw new Error(message)
    }

    if (!vapidPublicKey) {
      const message = getMissingVapidKeyError()
      setError(message)
      throw new Error(message)
    }

    setIsEnabling(true)
    setError(null)

    try {
      const nextSubscription = await enablePush(vapidPublicKey)
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
          : 'Unable to enable push notifications at this time.'
      console.error('❌ Push enable error:', err)
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsEnabling(false)
    }
  }, [supported])

  const disable = useCallback(async () => {
    if (!supported) {
      const message = getUnsupportedError()
      setError(message)
      throw new Error(message)
    }

    setIsDisabling(true)
    setError(null)

    try {
      await disablePush()
      setSubscription(null)
      setPermission(getPushPermissionStatus())
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to disable push notifications at this time.'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      setIsDisabling(false)
    }
  }, [supported])

  const canEnable = supported && hasVapidKey && !subscription && permission !== 'denied'

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
    canEnable
  }
}

