import { act, render, screen, waitFor } from "@testing-library/react"
import { ClipboardList, MapPin } from "lucide-react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"

import { MobileNavBar } from "@/components/layout/MobileNavBar"
import type { NavigationItem } from "@/components/layout/SidebarNavigation"

const originalInnerHeight = Object.getOwnPropertyDescriptor(window, "innerHeight")
const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport")

afterEach(() => {
  if (originalInnerHeight) {
    Object.defineProperty(window, "innerHeight", originalInnerHeight)
  }

  if (originalVisualViewport) {
    Object.defineProperty(window, "visualViewport", originalVisualViewport)
  } else {
    delete (window as { visualViewport?: VisualViewport }).visualViewport
  }
})

function createNavigationItem(overrides: Partial<NavigationItem> = {}): NavigationItem {
  return {
    id: "projects",
    label: "Proyectos",
    mobileLabel: "Proyectos",
    to: "/projects",
    icon: ClipboardList,
    mobileSlot: "primary",
    isActive: (pathname) => pathname === "/projects",
    ...overrides,
  }
}

function renderMobileNav() {
  return render(
    <MemoryRouter initialEntries={["/tours"]}>
      <MobileNavBar
        primaryItems={[
          createNavigationItem(),
          createNavigationItem({
            id: "tours",
            label: "Giras",
            mobileLabel: "Giras",
            to: "/tours",
            icon: MapPin,
            isActive: (pathname) => pathname === "/tours",
          }),
        ]}
        trayItems={[]}
        onSignOut={vi.fn()}
        isLoggingOut={false}
      />
    </MemoryRouter>,
  )
}

function mockVisualViewport({
  height,
  innerHeight,
  offsetTop,
}: {
  height: number
  innerHeight: number
  offsetTop: number
}) {
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  const visualViewport = {
    width: 390,
    height,
    offsetTop,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const typeListeners = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
      typeListeners.add(listener)
      listeners.set(type, typeListeners)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener)
    }),
  } as unknown as VisualViewport

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  })
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  })

  return {
    dispatch(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        const event = new Event(type)
        if (typeof listener === "function") {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }
    },
  }
}

/**
 * Replaces requestAnimationFrame with a manually-flushed queue so tests can
 * assert on the rAF-deferred follow-up recomputes without relying on real
 * frame timing.
 */
function mockRequestAnimationFrame() {
  const originalRaf = window.requestAnimationFrame
  const originalCaf = window.cancelAnimationFrame
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()

  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  }) as typeof window.requestAnimationFrame

  window.cancelAnimationFrame = vi.fn((id: number) => {
    callbacks.delete(id)
  }) as typeof window.cancelAnimationFrame

  return {
    // Drains every queued frame, including ones scheduled by callbacks that
    // run during the flush (e.g. the nested second rAF).
    flush() {
      while (callbacks.size > 0) {
        const [id, callback] = callbacks.entries().next().value as [number, FrameRequestCallback]
        callbacks.delete(id)
        callback(0)
      }
    },
    restore() {
      window.requestAnimationFrame = originalRaf
      window.cancelAnimationFrame = originalCaf
    },
  }
}

describe("MobileNavBar", () => {
  it("renders the fixed nav in a body portal", () => {
    const { container } = renderMobileNav()

    const nav = screen.getByRole("navigation", { name: /navegación principal/i })

    expect(nav.parentElement).toBe(document.body)
    expect(container).not.toContainElement(nav)
    expect(nav).toHaveClass("fixed", "bottom-0")
  })

  it("offsets the nav to the visual viewport bottom when browser chrome changes visible height", async () => {
    const visualViewport = mockVisualViewport({
      height: 700,
      innerHeight: 760,
      offsetTop: 0,
    })

    renderMobileNav()

    const nav = screen.getByRole("navigation", { name: /navegación principal/i })

    await waitFor(() => expect(nav.style.bottom).toBe("60px"))

    ;(window.visualViewport as unknown as { height: number }).height = 760

    act(() => {
      visualViewport.dispatch("resize")
    })

    await waitFor(() => expect(nav.style.bottom).toBe(""))
  })

  it("recomputes the offset on visibilitychange when iOS resumes a backgrounded PWA without firing resize", async () => {
    mockVisualViewport({
      height: 700,
      innerHeight: 760,
      offsetTop: 0,
    })
    const raf = mockRequestAnimationFrame()

    try {
      renderMobileNav()

      const nav = screen.getByRole("navigation", { name: /navegación principal/i })

      await waitFor(() => expect(nav.style.bottom).toBe("60px"))

      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      })

      // Dispatch while the viewport is still reporting the stale (backgrounded)
      // height, mirroring WebKit reporting old values for a frame or two after
      // resume. The immediate recompute should see no change yet.
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"))
      })
      expect(nav.style.bottom).toBe("60px")

      // The corrected height only becomes available a frame later, without any
      // "resize" event firing on resume (the iOS PWA behavior this guards
      // against).
      ;(window.visualViewport as unknown as { height: number }).height = 760

      act(() => {
        raf.flush()
      })

      expect(nav.style.bottom).toBe("")
    } finally {
      raf.restore()
    }
  })
})
