import { useEffect, type Dispatch, type SetStateAction } from "react";

import { getPanelPageCount } from "./model";
import type { CrewAssignmentsFeed, JobsOverviewFeed, LogisticsItem, PanelKey, PendingActionsFeed } from "./types";

type RotationOptions = {
  crew: CrewAssignmentsFeed | null;
  idx: number;
  logistics: LogisticsItem[] | null;
  overview: JobsOverviewFeed | null;
  pending: PendingActionsFeed | null;
  panelDurations: Record<PanelKey, number>;
  panelOrder: PanelKey[];
  panelPages: Record<PanelKey, number>;
  rotationFallbackSeconds: number;
  setIdx: Dispatch<SetStateAction<number>>;
  setPanelPages: Dispatch<SetStateAction<Record<PanelKey, number>>>;
};

/**
 * Next panel index. The Atención panel is skipped while there is nothing to act
 * on, unless it is the only panel left to show.
 */
export function getNextPanelIndex(
  current: number,
  panelOrder: PanelKey[],
  pending: PendingActionsFeed | null,
): number {
  if (!panelOrder.length) return 0;
  const hasAlerts = (pending?.items.length ?? 0) > 0;
  for (let step = 1; step <= panelOrder.length; step += 1) {
    const candidate = (current + step) % panelOrder.length;
    if (panelOrder[candidate] !== "pending" || hasAlerts) return candidate;
  }
  return (current + 1) % panelOrder.length;
}

export const useWallboardRotation = ({
  crew,
  idx,
  logistics,
  overview,
  pending,
  panelDurations,
  panelOrder,
  panelPages,
  rotationFallbackSeconds,
  setIdx,
  setPanelPages,
}: RotationOptions) => {
  useEffect(() => setIdx(0), [panelOrder, setIdx]);

  useEffect(() => {
    if (!panelOrder.length) return;
    const currentPanel = panelOrder[idx % panelOrder.length];
    const durationMs = Math.max(1, panelDurations[currentPanel] ?? rotationFallbackSeconds) * 1000;
    const timer = window.setTimeout(() => {
      const pageCount = getPanelPageCount(currentPanel, { overview, crew, logistics, pending });
      if (panelOrder.length === 1 && pageCount <= 1) return;

      const currentPage = panelPages[currentPanel] ?? 0;
      if (currentPage + 1 < pageCount) {
        setPanelPages((previous) => ({ ...previous, [currentPanel]: currentPage + 1 }));
      } else {
        setPanelPages((previous) => ({ ...previous, [currentPanel]: 0 }));
        setIdx((current) => getNextPanelIndex(current, panelOrder, pending));
      }
    }, durationMs);
    return () => clearTimeout(timer);
  }, [crew, idx, logistics, overview, pending, panelDurations, panelOrder, panelPages, rotationFallbackSeconds, setIdx, setPanelPages]);
};
