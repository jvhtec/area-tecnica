// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { useViewport, ViewportProvider } from "@/hooks/use-mobile";

const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");

function createVisualViewport(width: number, height: number): VisualViewport {
  const eventTarget = new EventTarget();

  return {
    width,
    height,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    onresize: null,
    onscroll: null,
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
  } as unknown as VisualViewport;
}

function setVisualViewport(visualViewport: VisualViewport): void {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  });
}

describe("useViewport", () => {
  afterEach(() => {
    if (originalVisualViewport) {
      Object.defineProperty(window, "visualViewport", originalVisualViewport);
      return;
    }

    Reflect.deleteProperty(window, "visualViewport");
  });

  it("prefers visualViewport dimensions when available", () => {
    setVisualViewport(createVisualViewport(390.4, 721.6));

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ViewportProvider>{children}</ViewportProvider>
    );

    const { result } = renderHook(() => useViewport(), { wrapper });

    expect(result.current.width).toBe(390);
    expect(result.current.height).toBe(722);
    expect(result.current.breakpoint).toBe("xs");
    expect(result.current.isMobile).toBe(true);
  });
});
