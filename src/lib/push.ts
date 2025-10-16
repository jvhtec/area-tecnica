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

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(vapidPublicKey)
    })
  }

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription.toJSON()),
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error('Failed to persist push subscription')
  }

  return subscription
}

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export const disablePush = async (): Promise<void> => {
  const subscription = await getExistingPushSubscription()

  if (!subscription) {
    return
  }

  const response = await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error('Failed to remove push subscription')
  }

  await subscription.unsubscribe()
}
