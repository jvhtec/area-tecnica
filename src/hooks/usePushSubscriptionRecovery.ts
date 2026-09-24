import { useEffect, useRef } from 'react'

const RECONCILE_MIN_INTERVAL_MS = 5 * 60 * 1000

/** Reconciles the current device with the server without requesting permission. */
export function usePushSubscriptionRecovery() {
  const hasPrompted = useRef(false)
  const isChecking = useRef(false)

  useEffect(() => {
    let disposed = false
    let lastRunAt = 0

    const reconcile = async (force = false) => {
      if (disposed || isChecking.current) return
      const now = Date.now()
      if (!force && now - lastRunAt < RECONCILE_MIN_INTERVAL_MS) return
      lastRunAt = now
      isChecking.current = true
      try {
        const [
          { toast },
          { supabase },
          webPush,
          nativePush,
        ] = await Promise.all([
          import('sonner'),
          import('@/lib/supabase'),
          import('@/lib/push'),
          import('@/lib/push-native'),
        ])

        const { data: { user } } = await supabase.auth.getUser()
        if (!user || disposed) return

        if (nativePush.isNativePushSupported()) {
          if (nativePush.getStoredNativePushToken()) {
            await nativePush.synchronizeNativePush()
          }
          return
        }
        if (!webPush.isPushSupported()) return

        const existing = await webPush.getExistingPushSubscription()
        if (existing) {
          await webPush.synchronizeExistingPushSubscription()
          return
        }

        const { data: preference, error } = await supabase
          .from('notification_preferences')
          .select('account_enabled')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error || !preference?.account_enabled || hasPrompted.current || disposed) return

        hasPrompted.current = true
        toast.warning('Este dispositivo necesita atención', {
          description: 'Las notificaciones están activadas en tu cuenta, pero este dispositivo no está registrado.',
          duration: 10000,
          action: {
            label: 'Reparar',
            onClick: () => {
              window.location.href = '/notifications?section=devices'
            },
          },
          cancel: { label: 'Ahora no', onClick: () => undefined },
        })
      } catch (error) {
        console.error('[Push Recovery] No se pudo comprobar la suscripción:', error)
      } finally {
        isChecking.current = false
      }
    }

    // The first reconciliation should always run once after startup. Later
    // visibility changes are throttled so ordinary tab switching does not
    // write the same device registration over and over.
    const timeoutId = window.setTimeout(() => void reconcile(true), 3000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void reconcile()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      disposed = true
      window.clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])
}
