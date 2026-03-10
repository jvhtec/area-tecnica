import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { resetMockSupabase } from "./mockSupabase";

const toast = Object.assign(vi.fn(), {
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  message: vi.fn(),
});

vi.mock("sonner", () => ({
  toast,
  Toaster: () => null,
}));

const createUnexpectedFetchError = (input?: RequestInfo | URL) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input && "url" in input
          ? input.url
          : "unknown-url";

  return new Error(
    `[tests] Unexpected network request to ${url}. Mock the module, Supabase client, or fetch in this test.`,
  );
};

beforeEach(() => {
  resetMockSupabase();
  toast.mockClear();
  toast.error.mockClear();
  toast.success.mockClear();
  toast.warning.mockClear();
  toast.message.mockClear();

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => Promise.reject(createUnexpectedFetchError(input))),
  );
});

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, "open", {
    writable: true,
    value: vi.fn(),
  });

  global.IntersectionObserver = class IntersectionObserver {
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  global.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;

  if (!document.head) {
    const head = document.createElement("head");
    document.documentElement?.appendChild(head);
  }

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  }

  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = vi.fn();
  }

  if (!HTMLElement.prototype.releasePointerCapture) {
    HTMLElement.prototype.releasePointerCapture = vi.fn();
  }
}
