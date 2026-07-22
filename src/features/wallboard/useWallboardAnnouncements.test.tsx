// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { useWallboardAnnouncements } from "./useWallboardAnnouncements";
import type { TickerMessage } from "./types";

describe("useWallboardAnnouncements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T10:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("parses highlights, reports stale rows, and expires active highlights", () => {
    const { result } = renderHook(() => {
      const [highlightJobs, setHighlightJobs] = useState(
        new Map<string, number>()
      );
      const [tickerMessages, setTickerMessages] = useState<TickerMessage[]>([]);
      const processAnnouncements = useWallboardAnnouncements(
        5000,
        setHighlightJobs,
        setTickerMessages
      );
      return { highlightJobs, processAnnouncements, tickerMessages };
    });

    let staleIds: string[] = [];
    act(() => {
      staleIds = result.current.processAnnouncements([
        {
          id: "active-announcement",
          message: "[HIGHLIGHT_JOB:a1b2-c3d4] Trabajo destacado",
          level: "warn",
          created_at: new Date().toISOString(),
        },
        {
          id: "stale-announcement",
          message: "[HIGHLIGHT_JOB:dead-beef] Trabajo antiguo",
          level: "critical",
          created_at: new Date(Date.now() - 6000).toISOString(),
        },
      ]);
    });

    expect(staleIds).toEqual(["stale-announcement"]);
    expect(result.current.highlightJobs.has("a1b2-c3d4")).toBe(true);
    expect(result.current.tickerMessages).toEqual([
      { message: "Trabajo destacado", level: "warn" },
      { message: "Trabajo antiguo", level: "critical" },
    ]);

    act(() => vi.advanceTimersByTime(10000));

    expect(result.current.highlightJobs.size).toBe(0);
  });
});
