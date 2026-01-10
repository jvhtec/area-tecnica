import { Capacitor } from '@capacitor/core'
import { PushNotifications, type PermissionStatus, type Token } from '@capacitor/push-notifications'

import { supabase } from '@/lib/supabase'

const NATIVE_PUSH_TOKEN_KEY = 'native_push_token'
const NATIVE_PUSH_PLATFORM = 'ios'
const REGISTRATION_TIMEOUT_MS = 15000

const toNotificationPermission = (status?: PermissionStatus): NotificationPermission => {
  if (!status?.receive) {
    return 'default'
  }

  if (status.receive === 'granted') {
    return 'granted'
  }

  if (status.receive === 'denied') {
    return 'denied'
  }

  return 'default'
}

const storeNativeToken = (token: string | null) => {
  try {
    if (!token) {
      localStorage.removeItem(NATIVE_PUSH_TOKEN_KEY)
      return
    }
    localStorage.setItem(NATIVE_PUSH_TOKEN_KEY, token)
  } catch {
    // Ignore storage errors (private mode, restricted storage, etc.)
  }
}

export const getStoredNativePushToken = (): string | null => {
  try {
    return localStorage.getItem(NATIVE_PUSH_TOKEN_KEY)
  } catch {
    return null
  }
}

const updatePushPreference = async (enabled: boolean) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return
  }

  await supabase
    .from('profiles')
    .update({ push_notifications_enabled: enabled })
    .eq('id', user.id)
}

const waitForRegistrationToken = async (): Promise<string> => {
  return await new Promise<string>(async (resolve, reject) => {
    let timeoutId: number | undefined
    let resolved = false
    let registrationHandle: { remove: () => Promise<void> } | null = null
    let errorHandle: { remove: () => Promise<void> } | null = null

    const cleanup = async () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      try {
        await registrationHandle?.remove()
      } catch {
        // Ignore listener cleanup errors
      }
      try {
        await errorHandle?.remove()
      } catch {
        // Ignore listener cleanup errors
      }
    }

    registrationHandle = await PushNotifications.addListener('registration', (token: Token) => {
      if (resolved) {
        return
      }
      resolved = true
      void cleanup().then(() => resolve(token.value))
    })

    errorHandle = await PushNotifications.addListener('registrationError', (error: any) => {
      if (resolved) {
        return
      }
      resolved = true
      const message = error?.message || 'Unable to register for native push notifications.'
      void cleanup().then(() => reject(new Error(message)))
    })

    timeoutId = window.setTimeout(() => {
      if (resolved) {
        return
      }
      resolved = true
      void cleanup().then(() => reject(new Error('Timed out waiting for native push registration.')))
    }, REGISTRATION_TIMEOUT_MS)
  })
}

export const isNativePushSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  if (!Capacitor?.isNativePlatform?.()) {
    return false
  }

  return Capacitor.getPlatform() === NATIVE_PUSH_PLATFORM
}

export const getNativePushPermissionStatus = async (): Promise<NotificationPermission> => {
  if (!isNativePushSupported()) {
    return 'default'
  }

  try {
    const status = await PushNotifications.checkPermissions()
    return toNotificationPermission(status)
  } catch {
    return 'default'
  }
}

export const enableNativePush = async (): Promise<string | null> => {
  if (!isNativePushSupported()) {
    throw new Error('Native push notifications are not supported on this device.')
  }

  let status = await PushNotifications.checkPermissions()
  if (status.receive === 'prompt') {
    status = await PushNotifications.requestPermissions()
  }

  if (status.receive !== 'granted') {
    return null
  }

  const tokenPromise = waitForRegistrationToken()
  await PushNotifications.register()
  const token = await tokenPromise

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'subscribe_native',
      platform: NATIVE_PUSH_PLATFORM,
      token
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to register native push token.')
  }

  storeNativeToken(token)
  await updatePushPreference(true)
  return token
}

export const disableNativePush = async (): Promise<void> => {
  if (!isNativePushSupported()) {
    return
  }

  const token = getStoredNativePushToken()

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'unsubscribe_native',
      platform: NATIVE_PUSH_PLATFORM,
      token: token || undefined
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to unregister native push token.')
  }

  await PushNotifications.unregister()
  storeNativeToken(null)
  await updatePushPreference(false)
}
