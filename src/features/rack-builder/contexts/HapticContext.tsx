import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useWebHaptics } from 'web-haptics/react'
import type { HapticInput, TriggerOptions } from 'web-haptics'

interface HapticContextValue {
  trigger: (input?: HapticInput, options?: TriggerOptions) => void
  cancel: () => void
  isSupported: boolean
}

const HapticContext = createContext<HapticContextValue | null>(null)

const BUTTON_SELECTOR = 'button, [role="button"], a[href], input[type="button"], input[type="submit"]'

export function HapticProvider({ children }: { children: ReactNode }) {
  const { trigger, cancel, isSupported } = useWebHaptics()
  const triggerRef = useRef(trigger)
  triggerRef.current = trigger

  // The library uses display:none when showSwitch is false, which prevents
  // iOS from triggering native haptics on the hidden switch checkbox.
  // Once the library creates its DOM element (on first trigger call), swap
  // display:none for off-screen positioning so iOS still honours the switch.
  useEffect(() => {
    const fixLabel = (label: HTMLElement) => {
      label.style.display = ''
      label.style.position = 'fixed'
      label.style.left = '-9999px'
      label.style.top = '-9999px'
      label.style.opacity = '0'
      label.style.pointerEvents = 'none'
      const input = label.querySelector<HTMLElement>('input')
      if (input) input.style.display = ''
    }
    const existing = document.querySelector<HTMLElement>('label[for^="web-haptics-"]')
    if (existing) { fixLabel(existing); return }
    const observer = new MutationObserver(() => {
      const label = document.querySelector<HTMLElement>('label[for^="web-haptics-"]')
      if (label) { fixLabel(label); observer.disconnect() }
    })
    observer.observe(document.body, { childList: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const el = (e.target as Element)?.closest?.(BUTTON_SELECTOR)
      if (el && !('disabled' in el && (el as HTMLButtonElement).disabled) && el.getAttribute('aria-disabled') !== 'true') {
        triggerRef.current('nudge')
      }
    }
    document.addEventListener('pointerdown', handler, { passive: true })
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const value = useMemo(
    () => ({ trigger, cancel, isSupported }),
    [trigger, cancel, isSupported],
  )

  return (
    <HapticContext.Provider value={value}>
      {children}
    </HapticContext.Provider>
  )
}

const NOOP_HAPTIC: HapticContextValue = {
  trigger: () => {},
  cancel: () => {},
  isSupported: false,
}

export function useHaptic() {
  return useContext(HapticContext) ?? NOOP_HAPTIC
}
