import "@testing-library/jest-dom/vitest";
import { expect, vi } from "vitest";
import { toHaveNoViolations } from "vitest-axe";

expect.extend(toHaveNoViolations);

const defaultMatchMedia = (query: string) => ({
  matches: /max-width:\s?767px/.test(query),
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(() => false),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: defaultMatchMedia,
});

Object.defineProperty(window, "innerWidth", {
  value: 390,
  writable: true,
});

Object.defineProperty(window, "innerHeight", {
  value: 844,
  writable: true,
});

Object.defineProperty(navigator, "userAgent", {
  value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
  configurable: true,
});

if (!("ontouchstart" in window)) {
  Object.defineProperty(window, "ontouchstart", {
    value: null,
    configurable: true,
  });
}

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

if (typeof window.ResizeObserver === "undefined") {
  // @ts-expect-error test shim
  window.ResizeObserver = MockResizeObserver;
}

if (!window.scrollTo) {
  window.scrollTo = vi.fn();
}
