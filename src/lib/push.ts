import { supabase } from '@/lib/supabase'

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
  vapidPublicKey: string
): Promise<PushSubscription | null> => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser')
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
        'Unable to register the service worker required for push notifications. Reload the page and try again.'
      )
    }
  }

  try {
    registration = await navigator.serviceWorker.ready
  } catch (error) {
    console.error('Service worker failed to become ready for push', error)
    throw new Error('The service worker failed to initialize. Reload the page and try again.')
  }

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(vapidPublicKey)
    })
  }

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'subscribe',
      subscription: subscription.toJSON()
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to persist push subscription')
  }

  return subscription
}

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  const registration =
    (await navigator.serviceWorker.getRegistration('/')) ||
    (await navigator.serviceWorker.ready.catch(() => undefined))

  if (!registration) {
    return null
  }

  return registration.pushManager.getSubscription()
}

export const disablePush = async (): Promise<void> => {
  const subscription = await getExistingPushSubscription()

  if (!subscription) {
    return
  }

  const { error } = await supabase.functions.invoke('push', {
    body: {
      action: 'unsubscribe',
      endpoint: subscription.endpoint
    }
  })

  if (error) {
    throw new Error(error.message || 'Failed to remove push subscription')
  }

  await subscription.unsubscribe()
}
