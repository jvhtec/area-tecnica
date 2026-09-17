import { useEffect, useRef } from 'react'

/** Reconciles the current device with the server without requesting permission. */
export function usePushSubscriptionRecovery() {
  const hasPrompted = useRef(false)
  const isChecking = useRef(false)

  useEffect(() => {
    let disposed = false

    const reconcile = async () => {
      if (disposed || isChecking.current) return
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

    const timeoutId = window.setTimeout(() => void reconcile(), 3000)
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
