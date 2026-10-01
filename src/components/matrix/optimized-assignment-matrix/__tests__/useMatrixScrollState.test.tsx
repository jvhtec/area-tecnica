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
  technicianWidth: 0,
  headerHeight: 0,
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

  it("ignores pending window updates after unmount", () => {
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

  it("keeps the vertical position when the date range grows", () => {
    const { result, rerender } = renderHook((args: typeof defaultArgs) => useMatrixScrollState(args), {
      initialProps: defaultArgs,
    });
    const main = createScrollableDiv();

    result.current.mainScrollRef.current = main;

    // Establish a horizontal baseline, then scroll down only — the case that
    // used to return before recording the position.
    act(() => {
      main.scrollLeft = 0;
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });
    act(() => {
      main.scrollTop = 240;
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    // Expanding forwards appends dates and keeps the same first date.
    act(() => {
      rerender({
        ...defaultArgs,
        dates: [...defaultArgs.dates, new Date("2026-04-12T00:00:00.000Z")],
      });
    });

    expect(main.scrollTop).toBe(240);
  });

  it("keeps the newest vertical position when events outrun the update frame", () => {
    const { result, rerender } = renderHook((args: typeof defaultArgs) => useMatrixScrollState(args), {
      initialProps: defaultArgs,
    });
    const main = createScrollableDiv();

    result.current.mainScrollRef.current = main;

    act(() => {
      main.scrollLeft = 0;
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    // Two vertical events with no frame in between: one window update is
    // pending, and the second event is still the newest position.
    act(() => {
      main.scrollTop = 120;
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      main.scrollTop = 360;
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    act(() => {
      rerender({
        ...defaultArgs,
        dates: [...defaultArgs.dates, new Date("2026-04-12T00:00:00.000Z")],
      });
    });

    expect(main.scrollTop).toBe(360);
  });

  it("keeps the same column when the cell width changes", () => {
    // Crossing the mobile breakpoint (or rotating) re-lays out the grid at a
    // new cellWidth. The restore effect runs on that change too, and used to
    // reapply the pixel offset measured at the *old* width — the same pixels,
    // a different date. Here: column 3 at 120px is 360px, which at 40px would
    // land on column 9 instead.
    const { result, rerender } = renderHook((args: typeof defaultArgs) => useMatrixScrollState(args), {
      initialProps: defaultArgs,
    });
    const main = createScrollableDiv();

    result.current.mainScrollRef.current = main;

    act(() => {
      main.scrollLeft = 360; // column 3 at cellWidth 120
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    act(() => {
      rerender({ ...defaultArgs, cellWidth: 40 });
    });

    // Column 3 at cellWidth 40.
    expect(main.scrollLeft).toBe(120);
  });

  it("still shifts by the prepended columns when the range grows backwards", () => {
    const { result, rerender } = renderHook((args: typeof defaultArgs) => useMatrixScrollState(args), {
      initialProps: defaultArgs,
    });
    const main = createScrollableDiv();

    result.current.mainScrollRef.current = main;

    act(() => {
      main.scrollLeft = 240; // column 2 at cellWidth 120
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    // Two earlier days prepended: the old first date moves to index 2, so the
    // same day is now column 4.
    act(() => {
      rerender({
        ...defaultArgs,
        dates: [
          new Date("2026-04-08T00:00:00.000Z"),
          new Date("2026-04-09T00:00:00.000Z"),
          ...defaultArgs.dates,
        ],
      });
    });

    expect(main.scrollLeft).toBe(480);
  });

  it("windows the grid past the sticky header row and technician column", () => {
    // 20 technicians x 30 days at 100x50; the scroller is 700x450 with a 200px
    // sticky column and a 50px sticky header, so the grid shows 500x400.
    const dates = Array.from({ length: 30 }, (_, index) => new Date(Date.UTC(2026, 3, 1 + index)));
    const { result } = renderHook(() =>
      useMatrixScrollState({
        ...defaultArgs,
        dates,
        techniciansLength: 20,
        cellWidth: 100,
        cellHeight: 50,
        technicianWidth: 200,
        headerHeight: 50,
      }),
    );
    const main = createScrollableDiv({ scrollLeft: 1000, scrollTop: 250 });
    Object.defineProperties(main, {
      clientWidth: { value: 700 },
      clientHeight: { value: 450 },
      scrollWidth: { value: 3200 },
      scrollHeight: { value: 1050 },
    });
    result.current.mainScrollRef.current = main;

    act(() => {
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
      flushAnimationFrames();
    });

    // Visible: columns 10..15 (1000..1500) and rows 5..13 (250..650), plus the
    // desktop overscan of 3 columns and 5 rows.
    expect(result.current.visibleCols).toEqual({ start: 7, end: 18 });
    expect(result.current.visibleRows).toEqual({ start: 0, end: 18 });
  });
});
