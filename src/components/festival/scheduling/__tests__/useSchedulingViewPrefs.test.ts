// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSchedulingViewPrefs } from "../useSchedulingViewPrefs";

const KEY = "festival-scheduling-view";

describe("useSchedulingViewPrefs", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts on the board grouped by stage", () => {
    const { result } = renderHook(() => useSchedulingViewPrefs());
    expect(result.current[0]).toEqual({ view: "board", laneBy: "stage" });
  });

  it("remembers what was chosen, per field", () => {
    const first = renderHook(() => useSchedulingViewPrefs());
    act(() => first.result.current[1]({ view: "table" }));
    act(() => first.result.current[1]({ laneBy: "department" }));
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "{}")).toEqual({ view: "table", laneBy: "department" });

    const later = renderHook(() => useSchedulingViewPrefs());
    expect(later.result.current[0]).toEqual({ view: "table", laneBy: "department" });
  });

  it("falls back to the defaults for anything it does not recognise", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ view: "carousel", laneBy: 7 }));
    expect(renderHook(() => useSchedulingViewPrefs()).result.current[0]).toEqual({ view: "board", laneBy: "stage" });

    window.localStorage.setItem(KEY, "{not json");
    expect(renderHook(() => useSchedulingViewPrefs()).result.current[0]).toEqual({ view: "board", laneBy: "stage" });
  });

  it("still applies a choice when the browser refuses to store it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useSchedulingViewPrefs());

    act(() => result.current[1]({ view: "table" }));

    expect(result.current[0].view).toBe("table");
  });

  it("works when storage cannot even be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(renderHook(() => useSchedulingViewPrefs()).result.current[0]).toEqual({ view: "board", laneBy: "stage" });
  });
});
