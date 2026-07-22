// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { useWallboardRotation } from "./useWallboardRotation";
import type { JobsOverviewFeed, PanelKey } from "./types";

const PANEL_DURATIONS: Record<PanelKey, number> = {
  overview: 1,
  crew: 1,
  logistics: 1,
  pending: 1,
  calendar: 1,
};

const makeOverview = (jobCount: number): JobsOverviewFeed => ({
  jobs: Array.from(
    { length: jobCount },
    (_, index): JobsOverviewFeed["jobs"][number] => ({
      id: `job-${index}`,
      title: `Trabajo ${index}`,
      start_time: "2026-07-22T08:00:00Z",
      end_time: "2026-07-22T18:00:00Z",
      location: null,
      departments: [],
      crewAssigned: { sound: 0, lights: 0, video: 0 },
      crewNeeded: { sound: 0, lights: 0, video: 0 },
      docs: {},
      status: "green",
    })
  ),
});

const renderRotation = (panelOrder: PanelKey[], overview: JobsOverviewFeed) =>
  renderHook(() => {
    const [idx, setIdx] = useState(0);
    const [panelPages, setPanelPages] = useState<Record<PanelKey, number>>({
      overview: 0,
      crew: 0,
      logistics: 0,
      pending: 0,
      calendar: 0,
    });

    useWallboardRotation({
      crew: null,
      idx,
      logistics: null,
      overview,
      panelDurations: PANEL_DURATIONS,
      panelOrder,
      panelPages,
      rotationFallbackSeconds: 1,
      setIdx,
      setPanelPages,
    });

    return { idx, panelPages };
  });

describe("useWallboardRotation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("increments the current panel page before advancing panels", () => {
    const { result } = renderRotation(["overview"], makeOverview(7));

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.panelPages.overview).toBe(1);
    expect(result.current.idx).toBe(0);
  });

  it("resets the page and advances when the current panel is exhausted", () => {
    const { result } = renderRotation(["overview", "crew"], makeOverview(1));

    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.panelPages.overview).toBe(0);
    expect(result.current.idx).toBe(1);
  });

  it("keeps a single one-page panel stable", () => {
    const { result } = renderRotation(["overview"], makeOverview(1));

    act(() => vi.advanceTimersByTime(5000));

    expect(result.current.panelPages.overview).toBe(0);
    expect(result.current.idx).toBe(0);
  });
});
