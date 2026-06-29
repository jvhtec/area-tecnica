// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMatrixScrollState } from "../useMatrixScrollState";

vi.mock("@/hooks/useDragScroll", () => ({
  useDragScroll: vi.fn(),
}));

const defaultArgs = {
  dates: [new Date("2026-04-10T00:00:00.000Z"), new Date("2026-04-11T00:00:00.000Z")],
  techniciansLength: 2,
  cellWidth: 120,
  cellHeight: 48,
  matrixWidth: 240,
  mobile: false,
  isInitialLoading: false,
  canExpandBefore: false,
  canExpandAfter: false,
};

const createScrollableDiv = (overrides: Partial<Pick<HTMLDivElement, "scrollLeft" | "scrollTop">> = {}) => {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollLeft: { value: overrides.scrollLeft ?? 0, writable: true },
    scrollTop: { value: overrides.scrollTop ?? 0, writable: true },
    scrollWidth: { value: 500, writable: true },
    scrollHeight: { value: 500, writable: true },
    clientWidth: { value: 200, writable: true },
    clientHeight: { value: 120, writable: true },
  });
  return element;
};

describe("useMatrixScrollState", () => {
  const rafCallbacks: FrameRequestCallback[] = [];
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    rafCallbacks.length = 0;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (window as Partial<Window>).requestAnimationFrame;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const flushAnimationFrames = () => {
    while (rafCallbacks.length > 0) {
      rafCallbacks.shift()?.(performance.now());
    }
  };

  it("captures date header scroll values before throttled work runs", () => {
    const { result } = renderHook(() => useMatrixScrollState(defaultArgs));
    const header = createScrollableDiv({ scrollLeft: 96 });
    const main = createScrollableDiv();

    result.current.dateHeadersRef.current = header;
    result.current.mainScrollRef.current = main;

    const event = { currentTarget: header } as React.UIEvent<HTMLDivElement>;

    act(() => {
      result.current.handleDateHeadersScroll(event);
    });
    (event as unknown as { currentTarget: HTMLDivElement | null }).currentTarget = null;

    expect(() => {
      act(() => {
        vi.runOnlyPendingTimers();
        flushAnimationFrames();
      });
    }).not.toThrow();
    expect(main.scrollLeft).toBe(96);
  });

  it("ignores pending scroll sync frames after unmount", () => {
    const { result, unmount } = renderHook(() => useMatrixScrollState(defaultArgs));
    const main = createScrollableDiv({ scrollLeft: 120, scrollTop: 40 });

    result.current.mainScrollRef.current = main;

    act(() => {
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
    });
    unmount();

    expect(() => {
      act(() => {
        flushAnimationFrames();
      });
    }).not.toThrow();
  });
});
