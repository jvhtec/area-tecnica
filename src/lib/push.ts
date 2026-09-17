import { supabase } from '@/lib/supabase'
import { getPushDeviceId, getPushDeviceName } from '@/lib/pushDevice'

const base64Padding = (base64: string): string =>
  base64 + '='.repeat((4 - (base64.length % 4 || 4)) % 4)

const base64ToUint8 = (base64: string): Uint8Array => {
  const padded = base64Padding(base64.replace(/-/g, '+').replace(/_/g, '/'))
  const rawData = atob(padded)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export const isPushSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  )
}

export const getPushPermissionStatus = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default'
  }

  return Notification.permission
}

export const requestPushPermission = async (): Promise<NotificationPermission> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  const permission = await Notification.requestPermission()
  return permission
}

export const enablePush = async (
  vapidPublicKey: string,
  options: { sendWelcome?: boolean } = {},
): Promise<PushSubscription | null> => {
  if (!isPushSupported()) {
    throw new Error('Este navegador no admite notificaciones push.')
  }

  const permission = await requestPushPermission()

  if (permission !== 'granted') {
    return null
  }

  let registration = await navigator.serviceWorker.getRegistration('/')

  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    } catch (error) {
      console.error('Failed to register service worker for push', error)
      throw new Error(
        'No se pudo registrar el servicio necesario para las notificaciones. Recarga la página e inténtalo de nuevo.'
      )
    }
  }

  try {
    registration = await navigator.serviceWorker.ready
  } catch (error) {
    console.error('Service worker failed to become ready for push', error)
    throw new Error('El servicio de notificaciones no pudo iniciarse. Recarga la página e inténtalo de nuevo.')
  }

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(vapidPublicKey) as BufferSource
    })
  }

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'subscribe',
      subscription: subscription.toJSON(),
      device_id: getPushDeviceId(),
      device_name: getPushDeviceName(),
      send_welcome: options.sendWelcome ?? true,
    }
  })

  if (error) {
    throw new Error(error.message || 'No se pudo guardar la suscripción push.')
  }

  return subscription
}

export const synchronizeExistingPushSubscription = async (): Promise<boolean> => {
  const subscription = await getExistingPushSubscription()
  if (!subscription) return false
  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'subscribe',
      subscription: subscription.toJSON(),
      device_id: getPushDeviceId(),
      device_name: getPushDeviceName(),
      send_welcome: false,
    },
  })
  if (error) throw new Error(error.message || 'No se pudo sincronizar la suscripción push.')
  return true
}

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  const registration =
    (await navigator.serviceWorker.getRegistration('/')) ||
    (await navigator.serviceWorker.ready.catch((): undefined => undefined))

  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export const disablePush = async (): Promise<void> => {
  const subscription = await getExistingPushSubscription()

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'unsubscribe',
      endpoint: subscription?.endpoint,
      device_id: getPushDeviceId(),
    }
  })

  if (error) {
    throw new Error(error.message || 'No se pudo eliminar la suscripción push.')
  }

  await subscription?.unsubscribe()
}
