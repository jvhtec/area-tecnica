import { useEffect, useRef, useState } from 'react'

export type SwDebugEvent = {
  source: 'sw'
  type: string
  data?: any
  ts: number
}

export const usePushDebug = () => {
  const [events, setEvents] = useState<SwDebugEvent[]>([])
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const handler = (e: MessageEvent) => {
      const msg = e.data
      if (!msg || msg.source !== 'sw') return
      if (!mounted.current) return
      setEvents((prev) => {
        const next = [...prev, msg]
        // keep last 20 events
        return next.slice(-20)
      })
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handler)
      // poke the SW to ensure a controller responds
      navigator.serviceWorker.controller?.postMessage({ type: 'sw:ping' })
    }

    return () => {
      mounted.current = false
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handler)
      }
    }
  }, [])

  const showLocalTest = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.ready)
    // try via SW message (works even if page context has quirks)
    const target = navigator.serviceWorker.controller || reg?.active
    target?.postMessage({ type: 'sw:show-test', data: { title: 'Local SW test', body: 'Testing notification display' } })
  }

  const getSubscriptionInfo = async (): Promise<any | null> => {
    if (!('serviceWorker' in navigator)) return null
    try {
      const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.ready)
      const sub = await reg?.pushManager.getSubscription()
      return sub?.toJSON() ?? null
    } catch {
      return null
    }
  }

  return { events, showLocalTest, getSubscriptionInfo }
}

