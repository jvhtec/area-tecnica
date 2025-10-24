import * as React from "react"

// Shared responsive breakpoints aligned with Tailwind screens
export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"

export const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 360,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1440,
  "3xl": 1680,
}

const MOBILE_BREAKPOINT = BREAKPOINTS.md

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS["3xl"]) return "3xl"
  if (width >= BREAKPOINTS["2xl"]) return "2xl"
  if (width >= BREAKPOINTS.xl) return "xl"
  if (width >= BREAKPOINTS.lg) return "lg"
  if (width >= BREAKPOINTS.md) return "md"
  if (width >= BREAKPOINTS.sm) return "sm"
  return "xs"
}

function detectMobileDevice(): boolean {
  const userAgent = typeof window !== "undefined" ? navigator.userAgent : ""
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 0
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
  return (
    mobileRegex.test(userAgent) ||
    screenWidth < MOBILE_BREAKPOINT ||
    (isTouchDevice && isIOS)
  )
}

export interface ViewportValue {
  width: number
  height: number
  breakpoint: Breakpoint
  isMobile: boolean
  // helpers
  atLeast: (bp: Breakpoint) => boolean
  atMost: (bp: Breakpoint) => boolean
  above: (bp: Breakpoint) => boolean
  below: (bp: Breakpoint) => boolean
  between: (min: Breakpoint, max: Breakpoint) => boolean
}

const ViewportContext = React.createContext<ViewportValue | undefined>(undefined)

export function ViewportProvider({
  children,
  initialWidth,
  initialHeight,
}: {
  children: React.ReactNode
  initialWidth?: number
  initialHeight?: number
}) {
  const getDims = React.useCallback(() => {
    if (typeof window === "undefined") {
      const w = initialWidth ?? 1024
      const h = initialHeight ?? 768
      return { width: w, height: h }
    }

    // Prefer visualViewport when available to better reflect on-screen size
    const vv = (window as any).visualViewport as VisualViewport | undefined
    const width = Math.round((vv?.width ?? window.innerWidth) || 0)
    const height = Math.round((vv?.height ?? window.innerHeight) || 0)
    return { width, height }
  }, [initialWidth, initialHeight])

  const [dims, setDims] = React.useState(() => getDims())

  React.useEffect(() => {
    const handleResize = () => setDims(getDims())

    window.addEventListener("resize", handleResize)
    window.addEventListener("orientationchange", handleResize)

    const vv = (window as any).visualViewport as VisualViewport | undefined
    vv?.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleResize)
      vv?.removeEventListener("resize", handleResize)
    }
  }, [getDims])

  const value = React.useMemo<ViewportValue>(() => {
    const breakpoint = getBreakpoint(dims.width)
    const isMobile = dims.width < MOBILE_BREAKPOINT

    const atLeast = (bp: Breakpoint) => dims.width >= BREAKPOINTS[bp]
    const atMost = (bp: Breakpoint) => dims.width < BREAKPOINTS[bp]
    const above = atLeast
    const below = atMost
    const between = (min: Breakpoint, max: Breakpoint) =>
      dims.width >= BREAKPOINTS[min] && dims.width < BREAKPOINTS[max]

    return {
      width: dims.width,
      height: dims.height,
      breakpoint,
      isMobile,
      atLeast,
      atMost,
      above,
      below,
      between,
    }
  }, [dims])

  return (
    <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>
  )
}

export function useViewport(): ViewportValue {
  const ctx = React.useContext(ViewportContext)
  if (!ctx) {
    // Fallback for components used outside provider (SSR/legacy)
    const width = typeof window !== "undefined" ? window.innerWidth : 1024
    const height = typeof window !== "undefined" ? window.innerHeight : 768
    const breakpoint = getBreakpoint(width)
    const isMobile = width < MOBILE_BREAKPOINT
    const atLeast = (bp: Breakpoint) => width >= BREAKPOINTS[bp]
    const atMost = (bp: Breakpoint) => width < BREAKPOINTS[bp]
    const above = atLeast
    const below = atMost
    const between = (min: Breakpoint, max: Breakpoint) =>
      width >= BREAKPOINTS[min] && width < BREAKPOINTS[max]

    return { width, height, breakpoint, isMobile, atLeast, atMost, above, below, between }
  }
  return ctx
}

export function useIsMobile() {
  // Derive from shared viewport context when available
  const ctx = React.useContext(ViewportContext)
  const [fallback, setFallback] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (ctx) return

    const checkMobile = () => {
      setFallback(detectMobileDevice())
    }

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkMobile)
    checkMobile()
    return () => mql.removeEventListener("change", checkMobile)
  }, [ctx])

  return ctx ? ctx.isMobile : !!fallback
}
