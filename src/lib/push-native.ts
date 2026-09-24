import { Capacitor } from '@capacitor/core'
import {
  PushNotifications,
  type PermissionStatus,
  type RegistrationError,
  type Token,
} from '@capacitor/push-notifications'

import { supabase } from '@/lib/supabase'
import { getPushDeviceId, getPushDeviceName } from '@/lib/pushDevice'

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

const waitForRegistrationToken = async (): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
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

    // The listener setup is async, so it runs in an IIFE rather than an async
    // Promise executor — that way a failure while registering listeners rejects
    // the promise instead of being silently swallowed (and hanging the caller).
    void (async () => {
      try {
        registrationHandle = await PushNotifications.addListener('registration', (token: Token) => {
          if (resolved) {
            return
          }
          resolved = true
          void cleanup().then(() => resolve(token.value))
        })

        errorHandle = await PushNotifications.addListener('registrationError', (error: RegistrationError) => {
          if (resolved) {
            return
          }
          resolved = true
          const message = error.error || 'No se pudo registrar el dispositivo para las notificaciones.'
          void cleanup().then(() => reject(new Error(message)))
        })

        timeoutId = window.setTimeout(() => {
          if (resolved) {
            return
          }
          resolved = true
          void cleanup().then(() => reject(new Error('Se agotó el tiempo de espera al registrar las notificaciones.')))
        }, REGISTRATION_TIMEOUT_MS)
      } catch (err) {
        if (resolved) {
          return
        }
        resolved = true
        void cleanup().then(() =>
          reject(err instanceof Error ? err : new Error('No se pudo preparar el registro de notificaciones del dispositivo.'))
        )
      }
    })()
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

export const enableNativePush = async (
  options: { sendWelcome?: boolean } = {},
): Promise<string | null> => {
  if (!isNativePushSupported()) {
    throw new Error('Este dispositivo no admite notificaciones push nativas.')
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
      token,
      device_id: getPushDeviceId(),
      device_name: getPushDeviceName(),
      send_welcome: options.sendWelcome ?? true,
    }
  })

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el dispositivo para las notificaciones.')
  }

  storeNativeToken(token)
  return token
}

export const synchronizeNativePush = async (): Promise<boolean> => {
  const token = getStoredNativePushToken()
  if (!token) return false
  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'subscribe_native',
      platform: NATIVE_PUSH_PLATFORM,
      token,
      device_id: getPushDeviceId(),
      device_name: getPushDeviceName(),
      send_welcome: false,
    },
  })
  if (error) throw new Error(error.message || 'No se pudo sincronizar el dispositivo con el servidor.')
  return true
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
      token: token || undefined,
      device_id: getPushDeviceId(),
    }
  })

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar el registro de notificaciones del dispositivo.')
  }

  await PushNotifications.unregister()
  storeNativeToken(null)
}
