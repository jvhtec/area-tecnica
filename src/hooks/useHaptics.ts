import { useRef, useEffect, useCallback } from "react"
import { WebHaptics, type HapticInput, type TriggerOptions } from "web-haptics"

let sharedInstance: WebHaptics | null = null
let refCount = 0

function getSharedInstance(): WebHaptics | null {
  if (!WebHaptics.isSupported) return null
  if (!sharedInstance) {
    sharedInstance = new WebHaptics()
  }
  return sharedInstance
}

/**
 * Lightweight haptic feedback hook using web-haptics.
 * Shares a single WebHaptics instance across the entire app.
 *
 * Built-in patterns: success, warning, error, light, medium, heavy,
 * soft, rigid, selection, nudge, buzz
 */
export function useHaptics() {
  const instanceRef = useRef<WebHaptics | null>(null)

  useEffect(() => {
    instanceRef.current = getSharedInstance()
    refCount++
    return () => {
      refCount--
      if (refCount === 0 && sharedInstance) {
        sharedInstance.destroy()
        sharedInstance = null
      }
    }
  }, [])

  const trigger = useCallback(
    (input?: HapticInput, options?: TriggerOptions) => {
      instanceRef.current?.trigger(input, options)
    },
    [],
  )

  const cancel = useCallback(() => {
    instanceRef.current?.cancel()
  }, [])

  return { trigger, cancel, isSupported: WebHaptics.isSupported }
}

/**
 * Standalone haptic trigger for use outside React components (e.g. toast functions).
 * Uses the same shared WebHaptics singleton.
 */
export function triggerHaptic(input?: HapticInput, options?: TriggerOptions) {
  getSharedInstance()?.trigger(input, options)
}
