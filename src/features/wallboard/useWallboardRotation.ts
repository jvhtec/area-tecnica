import { useEffect, type Dispatch, type SetStateAction } from "react";

import { WALLBOARD_PANEL_PAGE_SIZES } from "./panelPageSizes";
import type { CrewAssignmentsFeed, JobsOverviewFeed, LogisticsItem, PanelKey } from "./types";

type RotationOptions = {
  crew: CrewAssignmentsFeed | null;
  idx: number;
  logistics: LogisticsItem[] | null;
  overview: JobsOverviewFeed | null;
  panelDurations: Record<PanelKey, number>;
  panelOrder: PanelKey[];
  panelPages: Record<PanelKey, number>;
  rotationFallbackSeconds: number;
  setIdx: Dispatch<SetStateAction<number>>;
  setPanelPages: Dispatch<SetStateAction<Record<PanelKey, number>>>;
};

export const useWallboardRotation = ({
  crew,
  idx,
  logistics,
  overview,
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
      const pageCount = currentPanel === "overview"
        ? Math.ceil((overview?.jobs.length ?? 0) / WALLBOARD_PANEL_PAGE_SIZES.overview)
        : currentPanel === "crew"
          ? Math.ceil((crew?.jobs.length ?? 0) / WALLBOARD_PANEL_PAGE_SIZES.crew)
          : currentPanel === "logistics"
            ? Math.ceil((logistics?.length ?? 0) / WALLBOARD_PANEL_PAGE_SIZES.logistics)
            : 1;
      if (panelOrder.length === 1 && pageCount <= 1) return;

      const currentPage = panelPages[currentPanel] ?? 0;
      if (currentPage + 1 < pageCount) {
        setPanelPages((previous) => ({ ...previous, [currentPanel]: currentPage + 1 }));
      } else {
        setPanelPages((previous) => ({ ...previous, [currentPanel]: 0 }));
        setIdx((current) => panelOrder.length > 0 ? (current + 1) % panelOrder.length : 0);
      }
    }, durationMs);
    return () => clearTimeout(timer);
  }, [crew, idx, logistics, overview, panelDurations, panelOrder, panelPages, rotationFallbackSeconds, setIdx, setPanelPages]);
};
