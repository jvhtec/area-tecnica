import { useCallback, useState } from "react";

import type { BoardLaneMode } from "./boardModel";

export type SchedulingView = "board" | "table";

export interface SchedulingViewPrefs {
  view: SchedulingView;
  laneBy: BoardLaneMode;
}

const STORAGE_KEY = "festival-scheduling-view";
const DEFAULT_PREFS: SchedulingViewPrefs = { view: "board", laneBy: "stage" };

const read = (): SchedulingViewPrefs => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SchedulingViewPrefs> | null;
    return {
      view: parsed?.view === "table" ? "table" : "board",
      laneBy: parsed?.laneBy === "department" ? "department" : "stage",
    };
  } catch {
    // Storage can be blocked or hold something else; the defaults are always fine.
    return DEFAULT_PREFS;
  }
};

/** The planner's view and lane choice, remembered per browser (a convenience, never required). */
export function useSchedulingViewPrefs() {
  const [prefs, setPrefs] = useState<SchedulingViewPrefs>(read);

  const update = useCallback((patch: Partial<SchedulingViewPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, still applied.
      }
      return next;
    });
  }, []);

  return [prefs, update] as const;
}
