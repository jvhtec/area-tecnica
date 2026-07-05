import { useEffect, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"
import { MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

import { NavigationItem } from "./SidebarNavigation"
import { MobileActionTray } from "./MobileActionTray"

interface MobileNavBarProps {
  primaryItems: NavigationItem[]
  trayItems: NavigationItem[]
  onSignOut: () => Promise<void> | void
  isLoggingOut: boolean
  notificationProps?: {
    userId: string
    userRole: string
    userDepartment: string | null
  }
  userRole?: string
  userEmail?: string
}

/**
 * Returns the inset between the layout viewport bottom and the visible viewport bottom.
 */
function getVisualViewportBottomOffset() {
  if (typeof window === "undefined" || !window.visualViewport) {
    return 0
  }

  const visualViewport = window.visualViewport
  const layoutViewportHeight = window.innerHeight
  const visualViewportBottom = visualViewport.offsetTop + visualViewport.height

  return Math.max(0, Math.round(layoutViewportHeight - visualViewportBottom))
}

// Input types that bring up a text-style on-screen keyboard. Excludes
// checkbox/radio/file/range/color/date/time/etc., which either show no
// keyboard at all or a non-text picker that doesn't resize the viewport the
// same way — trusting visualViewport while one of those is focused would let
// a stale WebKit reading detach the nav again with no keyboard in sight.
const TEXT_ENTRY_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
])

/**
 * Whether the currently focused element is one that would plausibly bring up
 * the on-screen keyboard. This is the ONLY legitimate reason the fixed nav
 * should ever be offset from `bottom: 0`.
 */
function isEditableElementFocused() {
  if (typeof document === "undefined") {
    return false
  }

  const active = document.activeElement as HTMLElement | null
  if (!active) {
    return false
  }

  if (active.tagName === "TEXTAREA") {
    return true
  }

  if (active.tagName === "INPUT") {
    return TEXT_ENTRY_INPUT_TYPES.has((active as HTMLInputElement).type)
  }

  return active.isContentEditable === true
}

/**
 * Tracks the on-screen-keyboard inset for fixed mobile chrome.
 *
 * iOS standalone PWAs have a well-documented WebKit bug where, after the app
 * is backgrounded and resumed (even briefly, and with no keyboard ever
 * involved), `visualViewport.height`/`offsetTop` can come back stale or
 * simply wrong — and stay wrong until a full reload, i.e. a plain resize/
 * scroll does NOT self-correct it. An earlier fix here tried to work around
 * that by recomputing from `visualViewport` on every resume signal, but that
 * still trusts numbers the browser itself is misreporting, so it can just as
 * easily "fix" the offset to a wrong nonzero value and pin the nav mid-screen.
 *
 * The only time a nonzero offset is ever legitimate is while the on-screen
 * keyboard is up, which requires a focused text input/textarea/contenteditable.
 * So we hard-clamp the offset to 0 whenever nothing editable is focused,
 * regardless of what `visualViewport` reports — including immediately on
 * resume — and only consult `visualViewport` while an editable element is
 * genuinely focused.
 */
function useVisualViewportBottomOffset() {
  const [bottomOffset, setBottomOffset] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    let pendingFrames: number[] = []

    const cancelPendingFrames = () => {
      pendingFrames.forEach((frameId) => cancelAnimationFrame(frameId))
      pendingFrames = []
    }

    const updateBottomOffset = () => {
      setBottomOffset(isEditableElementFocused() ? getVisualViewportBottomOffset() : 0)
    }

    updateBottomOffset()

    // Recompute a few times after resume in case an editable element was
    // already focused (keyboard open) before backgrounding and WebKit needs a
    // frame or two to report the correct post-resume viewport metrics.
    const recomputeOnResume = () => {
      cancelPendingFrames()
      updateBottomOffset()
      const firstFrame = requestAnimationFrame(() => {
        updateBottomOffset()
        const secondFrame = requestAnimationFrame(updateBottomOffset)
        pendingFrames.push(secondFrame)
      })
      pendingFrames.push(firstFrame)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recomputeOnResume()
      }
    }

    const visualViewport = window.visualViewport
    window.addEventListener("resize", updateBottomOffset)
    window.addEventListener("orientationchange", updateBottomOffset)
    visualViewport?.addEventListener("resize", updateBottomOffset)
    // NOTE: we intentionally do NOT listen to visualViewport "scroll". That event
    // fires continuously during momentum/rubber-band scrolling with transient
    // offsets, which made the fixed bottom bar chase the viewport and visibly
    // "unstick". Keyboard and browser-chrome changes still arrive via "resize".
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pageshow", recomputeOnResume)
    // Focus state is what gates whether we trust visualViewport at all, so
    // transitions in/out of an editable element must recompute immediately.
    document.addEventListener("focusin", updateBottomOffset)
    document.addEventListener("focusout", updateBottomOffset)

    return () => {
      window.removeEventListener("resize", updateBottomOffset)
      window.removeEventListener("orientationchange", updateBottomOffset)
      visualViewport?.removeEventListener("resize", updateBottomOffset)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pageshow", recomputeOnResume)
      document.removeEventListener("focusin", updateBottomOffset)
      document.removeEventListener("focusout", updateBottomOffset)
      cancelPendingFrames()
    }
  }, [])

  return bottomOffset
}

export const MobileNavBar = ({
  primaryItems,
  trayItems,
  onSignOut,
  isLoggingOut,
  notificationProps,
  userRole,
  userEmail,
}: MobileNavBarProps) => {
  const { pathname } = useLocation()
  const visualViewportBottomOffset = useVisualViewportBottomOffset()
  const hasNavigation = primaryItems.length > 0 || trayItems.length > 0
  // Always render the tray trigger so persistent actions like Sign Out and About
  // remain accessible for all roles, even when there are no additional tray items.
  const shouldShowTrayTrigger = true

  if (!hasNavigation) {
    return null
  }

  const activeInTray = trayItems.some((item) => item.isActive(pathname))
  const navStyle: CSSProperties | undefined = visualViewportBottomOffset > 0
    ? { bottom: `${visualViewportBottomOffset}px` }
    : undefined

  const nav = (
    <nav
      role="navigation"
      aria-label="Navegación principal"
      data-mobile-navbar
      className="fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-lg md:hidden"
      style={navStyle}
    >
      <div className="mx-auto flex w-full max-w-3xl items-stretch justify-evenly gap-1">
        {primaryItems.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive(pathname)

          return (
            <Link
              key={item.id}
              to={item.to}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-blue-400")} aria-hidden="true" />
              <span className="max-w-[5rem] truncate">{item.mobileLabel}</span>
            </Link>
          )
        })}
        {shouldShowTrayTrigger && (
          <MobileActionTray
            trayItems={trayItems}
            onSignOut={onSignOut}
            isLoggingOut={isLoggingOut}
            notificationProps={notificationProps}
            userRole={userRole}
            userEmail={userEmail}
            renderTrigger={(open) => (
              <button
                type="button"
                aria-label="Más opciones"
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:text-foreground hover:bg-accent",
                  (open || activeInTray) && "bg-blue-600/20 text-blue-400",
                )}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-[5rem] truncate">Más</span>
              </button>
            )}
          />
        )}
      </div>
    </nav>
  )

  return typeof document === "undefined" ? nav : createPortal(nav, document.body)
}
