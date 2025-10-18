import * as React from "react"

interface GlassMotionContextValue {
  position: { x: number; y: number }
  isPointerActive: boolean
  intensity: number
}

const GlassMotionContext = React.createContext<GlassMotionContextValue | undefined>(undefined)

export interface GlassMotionProviderProps {
  children: React.ReactNode
}

const defaultPosition = { x: 0, y: 0 }

export function GlassMotionProvider({ children }: GlassMotionProviderProps) {
  const [position, setPosition] = React.useState(defaultPosition)
  const [isPointerActive, setIsPointerActive] = React.useState(false)
  const [intensity, setIntensity] = React.useState(0.7)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const updatePointer = (event: PointerEvent) => {
      setPosition({ x: event.clientX, y: event.clientY })
      setIsPointerActive(true)
    }

    const deactivatePointer = () => setIsPointerActive(false)

    window.addEventListener("pointermove", updatePointer, { passive: true })
    window.addEventListener("pointerdown", updatePointer, { passive: true })
    window.addEventListener("pointerleave", deactivatePointer)
    window.addEventListener("blur", deactivatePointer)

    return () => {
      window.removeEventListener("pointermove", updatePointer)
      window.removeEventListener("pointerdown", updatePointer)
      window.removeEventListener("pointerleave", deactivatePointer)
      window.removeEventListener("blur", deactivatePointer)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const updateIntensity = () => {
      const computed = getComputedStyle(document.documentElement)
      const raw = computed.getPropertyValue("--glass-motion-intensity").trim()
      const numeric = raw.length ? Number.parseFloat(raw) : NaN
      setIntensity(Number.isFinite(numeric) ? numeric : 0.7)
    }

    updateIntensity()

    window.addEventListener("resize", updateIntensity)

    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    media.addEventListener("change", updateIntensity)

    return () => {
      window.removeEventListener("resize", updateIntensity)
      media.removeEventListener("change", updateIntensity)
    }
  }, [])

  const value = React.useMemo(
    () => ({ position, isPointerActive, intensity }),
    [position, isPointerActive, intensity],
  )

  return <GlassMotionContext.Provider value={value}>{children}</GlassMotionContext.Provider>
}

export function useGlassMotion() {
  const context = React.useContext(GlassMotionContext)
  if (!context) {
    return { position: defaultPosition, isPointerActive: false, intensity: 0 }
  }

  return context
}
