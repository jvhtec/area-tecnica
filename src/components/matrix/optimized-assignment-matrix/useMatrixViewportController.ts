import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { useDragScroll } from "@/hooks/useDragScroll";
import { useVirtualizedDateRange } from "@/hooks/useVirtualizedDateRange";
import { useVirtualizedMatrix } from "@/hooks/useVirtualizedMatrix";
import { throttle } from "@/utils/throttle";
import {
  formatMatrixDateKey,
  MATRIX_DATE_KEY_FORMAT,
  MATRIX_TIMEZONE,
} from "@/components/matrix/optimized-assignment-matrix/matrixCore";
import type { MatrixViewportState } from "@/components/matrix/optimized-assignment-matrix/types";

interface UseMatrixViewportControllerArgs {
  dates: Date[];
  technicianCount: number;
  mobile: boolean;
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  cellWidth: number;
  cellHeight: number;
  technicianWidth: number;
  headerHeight: number;
  isInitialLoading: boolean;
  onNearEdgeScroll?: (direction: "before" | "after") => void;
}

export function useMatrixViewportController({
  dates,
  technicianCount,
  mobile,
  canExpandBefore,
  canExpandAfter,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  isInitialLoading,
  onNearEdgeScroll,
}: UseMatrixViewportControllerArgs): MatrixViewportState {
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const syncInProgressRef = useRef(false);
  const syncScheduledRef = useRef(false);
  const syncAnimationFrameRef = useRef<number | null>(null);
  const pendingSyncRef = useRef<{ left: number; top: number; source: "main" | "dateHeaders" | "technician" } | null>(null);
  const lastKnownScrollRef = useRef({ left: 0, top: 0 });
  const autoScrolledRef = useRef(false);
  const hasHandledFirstScrollRef = useRef(false);
  const updateScheduledRef = useRef(false);
  const previousScrollLeftRef = useRef<number | null>(null);
  const lastEdgeTriggerRef = useRef(0);
  const previousDatesRef = useRef<Date[] | null>(null);

  const [virtualScroll, setVirtualScroll] = useState({ left: 0, top: 0 });
  const [virtualViewport, setVirtualViewport] = useState({ width: 0, height: 0 });
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

  const { getDateIndexByKey } = useVirtualizedDateRange({
    timezone: MATRIX_TIMEZONE,
    dateKeyFormat: MATRIX_DATE_KEY_FORMAT,
  });
  const virtualizedMatrix = useVirtualizedMatrix({
    totalRows: technicianCount,
    totalCols: dates.length,
    rowHeight: cellHeight,
    colWidth: cellWidth,
    containerHeight: virtualViewport.height,
    containerWidth: virtualViewport.width,
    overscanProfile: mobile ? "mobile" : "desktop",
    scrollLeft: virtualScroll.left,
    scrollTop: virtualScroll.top,
  });
  const matrixWidth = virtualizedMatrix.matrixWidth;
  const matrixHeight = virtualizedMatrix.matrixHeight;
  const visibleRows = virtualizedMatrix.window.rows;
  const visibleCols = virtualizedMatrix.window.cols;

  const syncScrollPositions = useCallback((scrollLeft: number, scrollTop: number, source: "main" | "dateHeaders" | "technician") => {
    pendingSyncRef.current = { left: scrollLeft, top: scrollTop, source };
    if (syncInProgressRef.current || syncScheduledRef.current) return;

    syncInProgressRef.current = true;
    syncScheduledRef.current = true;
    syncAnimationFrameRef.current = requestAnimationFrame(() => {
      const pendingSync = pendingSyncRef.current;
      if (!pendingSync) {
        syncAnimationFrameRef.current = null;
        syncScheduledRef.current = false;
        syncInProgressRef.current = false;
        return;
      }

      try {
        if (pendingSync.source !== "dateHeaders" && dateHeadersRef.current) {
          dateHeadersRef.current.scrollLeft = pendingSync.left;
        }
        if (pendingSync.source !== "main" && mainScrollRef.current) {
          mainScrollRef.current.scrollLeft = pendingSync.left;
          mainScrollRef.current.scrollTop = pendingSync.top;
        }
        if (pendingSync.source !== "technician" && technicianScrollRef.current) {
          technicianScrollRef.current.scrollTop = pendingSync.top;
        }
      } finally {
        void Promise.resolve().then(() => {
          pendingSyncRef.current = null;
          syncAnimationFrameRef.current = null;
          syncScheduledRef.current = false;
          syncInProgressRef.current = false;
        });
      }
    });
  }, []);

  const updateNavAvailability = useCallback(() => {
    if (!mobile) return;
    const element = dateHeadersRef.current;
    if (!element) return;

    const maxScroll = element.scrollWidth - element.clientWidth - 1;
    setCanNavLeft(element.scrollLeft > 2);
    setCanNavRight(element.scrollLeft < maxScroll);
  }, [mobile]);

  const updateVirtualizedWindow = useCallback(() => {
    const element = mainScrollRef.current;
    if (!element) return;

    const nextViewport = { width: element.clientWidth, height: element.clientHeight };
    setVirtualViewport((previous) =>
      previous.width !== nextViewport.width || previous.height !== nextViewport.height ? nextViewport : previous,
    );

    const nextScroll = { left: element.scrollLeft, top: element.scrollTop };
    setVirtualScroll((previous) =>
      previous.left !== nextScroll.left || previous.top !== nextScroll.top ? nextScroll : previous,
    );
  }, []);

  const scheduleVirtualizedWindowUpdate = useCallback(() => {
    if (!hasHandledFirstScrollRef.current) {
      hasHandledFirstScrollRef.current = true;
      updateVirtualizedWindow();
      return;
    }

    if (updateScheduledRef.current) return;
    updateScheduledRef.current = true;

    requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updateVirtualizedWindow();
    });
  }, [updateVirtualizedWindow]);

  useDragScroll(mainScrollRef, {
    enabled: !mobile,
    onScroll: (left, top) => {
      syncScrollPositions(left, top, "main");
      scheduleVirtualizedWindowUpdate();
      lastKnownScrollRef.current = { left, top };
    },
  });

  const handleMainScrollCore = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (syncInProgressRef.current) return;

      const scrollLeft = event.currentTarget.scrollLeft;
      const scrollTop = event.currentTarget.scrollTop;
      const previousScrollLeft = previousScrollLeftRef.current;
      const horizontalDelta = previousScrollLeft === null ? 0 : scrollLeft - previousScrollLeft;
      const movedHorizontally = previousScrollLeft !== null && horizontalDelta !== 0;

      if (previousScrollLeft !== null && !movedHorizontally) {
        syncScrollPositions(scrollLeft, scrollTop, "main");
        scheduleVirtualizedWindowUpdate();
        return;
      }

      previousScrollLeftRef.current = scrollLeft;

      const maxScrollLeft = event.currentTarget.scrollWidth - event.currentTarget.clientWidth;
      const nearLeftEdge = scrollLeft < 200;
      const nearRightEdge = scrollLeft > maxScrollLeft - 200;
      const now = performance.now();

      if (movedHorizontally && now - lastEdgeTriggerRef.current > 300) {
        if (horizontalDelta < 0 && nearLeftEdge && canExpandBefore && onNearEdgeScroll) {
          onNearEdgeScroll("before");
          lastEdgeTriggerRef.current = now;
        } else if (horizontalDelta > 0 && nearRightEdge && canExpandAfter && onNearEdgeScroll) {
          onNearEdgeScroll("after");
          lastEdgeTriggerRef.current = now;
        }
      }

      syncScrollPositions(scrollLeft, scrollTop, "main");
      lastKnownScrollRef.current = { left: scrollLeft, top: scrollTop };
      scheduleVirtualizedWindowUpdate();
    },
    [canExpandAfter, canExpandBefore, onNearEdgeScroll, scheduleVirtualizedWindowUpdate, syncScrollPositions],
  );

  const handleDateHeadersScrollCore = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (syncInProgressRef.current) return;
      const scrollLeft = event.currentTarget.scrollLeft;
      syncScrollPositions(scrollLeft, mainScrollRef.current?.scrollTop || 0, "dateHeaders");
      lastKnownScrollRef.current.left = scrollLeft;
      updateNavAvailability();
    },
    [syncScrollPositions, updateNavAvailability],
  );

  const handleTechnicianScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (syncInProgressRef.current) return;
      const scrollTop = event.currentTarget.scrollTop;
      syncScrollPositions(mainScrollRef.current?.scrollLeft || 0, scrollTop, "technician");
      lastKnownScrollRef.current.top = scrollTop;
      scheduleVirtualizedWindowUpdate();
    },
    [scheduleVirtualizedWindowUpdate, syncScrollPositions],
  );

  const handleDateHeadersScroll = useMemo(
    () => throttle(handleDateHeadersScrollCore, 12),
    [handleDateHeadersScrollCore],
  );

  useEffect(() => {
    return () => {
      if ("cancel" in handleDateHeadersScroll && typeof handleDateHeadersScroll.cancel === "function") {
        handleDateHeadersScroll.cancel();
      }
      if (syncAnimationFrameRef.current !== null) {
        cancelAnimationFrame(syncAnimationFrameRef.current);
      }
      pendingSyncRef.current = null;
    };
  }, [handleDateHeadersScroll]);

  const scrollToToday = useCallback(() => {
    const container = mainScrollRef.current;
    if (!container || dates.length === 0) return false;

    const todayMadridKey = formatInTimeZone(new Date(), MATRIX_TIMEZONE, MATRIX_DATE_KEY_FORMAT);
    const todayIndex = getDateIndexByKey(dates, todayMadridKey);
    if (todayIndex === -1 || container.clientWidth === 0) return false;

    let scrollPosition = todayIndex * cellWidth - container.clientWidth / 2 + cellWidth / 2;
    const maxScroll = matrixWidth - container.clientWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    container.scrollLeft = scrollPosition;

    return true;
  }, [cellWidth, dates, getDateIndexByKey, matrixWidth]);

  useEffect(() => {
    if (autoScrolledRef.current || isInitialLoading || dates.length === 0) return;

    let timeoutId: number | undefined;
    let attempts = 0;

    const attemptScroll = () => {
      if (scrollToToday()) {
        autoScrolledRef.current = true;
        return;
      }

      if (attempts >= 5) return;
      attempts += 1;
      timeoutId = window.setTimeout(attemptScroll, 100 * attempts);
    };

    timeoutId = window.setTimeout(attemptScroll, 50);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [dates.length, isInitialLoading, scrollToToday]);

  useEffect(() => {
    updateVirtualizedWindow();
  }, [technicianCount, dates.length, updateVirtualizedWindow]);

  useEffect(() => {
    const main = mainScrollRef.current;
    const headers = dateHeadersRef.current;
    const technicianScroller = technicianScrollRef.current;
    const previousDates = previousDatesRef.current;

    if (!main || dates.length === 0) {
      previousDatesRef.current = dates.slice();
      return;
    }

    const lastLeft = lastKnownScrollRef.current.left ?? main.scrollLeft;
    const lastTop = lastKnownScrollRef.current.top ?? main.scrollTop;
    let targetLeft = lastLeft;

    if (previousDates?.length) {
      const previousFirstKey = formatMatrixDateKey(previousDates[0]!);
      const nextIndex = dates.findIndex((date) => formatMatrixDateKey(date) === previousFirstKey);
      if (nextIndex > 0) {
        targetLeft = lastLeft + nextIndex * cellWidth;
      }
    }

    if (Math.abs(main.scrollLeft - targetLeft) > 1) {
      main.scrollLeft = targetLeft;
    }
    if (headers && Math.abs(headers.scrollLeft - targetLeft) > 1) {
      headers.scrollLeft = targetLeft;
    }
    if (technicianScroller && Math.abs(technicianScroller.scrollTop - lastTop) > 1) {
      technicianScroller.scrollTop = lastTop;
    }
    if (Math.abs(main.scrollTop - lastTop) > 1) {
      main.scrollTop = lastTop;
    }

    lastKnownScrollRef.current = { left: targetLeft, top: lastTop };
    previousScrollLeftRef.current = targetLeft;
    previousDatesRef.current = dates.slice();
    updateVirtualizedWindow();
  }, [cellWidth, dates, updateVirtualizedWindow]);

  useEffect(() => {
    if (!mobile) return;

    const updateStep = () => {
      const width = dateHeadersRef.current?.clientWidth || 0;
      const columns = Math.max(3, Math.min(4, Math.floor(width / cellWidth)) || 3);
      setNavStep(columns);
    };

    updateStep();
    window.addEventListener("resize", updateStep);
    return () => window.removeEventListener("resize", updateStep);
  }, [cellWidth, mobile]);

  useEffect(() => {
    if (!mobile) return;
    updateNavAvailability();
  }, [mobile, visibleCols, dates.length, updateNavAvailability]);

  const handleMobileNav = useCallback(
    (direction: "left" | "right") => {
      const headers = dateHeadersRef.current;
      const main = mainScrollRef.current;
      if (!headers || !main) return;

      const delta = navStep * cellWidth * (direction === "left" ? -1 : 1);
      const target = Math.max(0, Math.min(headers.scrollLeft + delta, headers.scrollWidth - headers.clientWidth));

      headers.scrollTo({ left: target, behavior: "smooth" });
      main.scrollTo({ left: target, top: main.scrollTop, behavior: "smooth" });
    },
    [cellWidth, navStep],
  );

  return {
    TECHNICIAN_WIDTH: technicianWidth,
    HEADER_HEIGHT: headerHeight,
    CELL_WIDTH: cellWidth,
    CELL_HEIGHT: cellHeight,
    matrixWidth,
    matrixHeight,
    dateHeadersRef,
    technicianScrollRef,
    mainScrollRef,
    visibleCols,
    visibleRows,
    canNavLeft,
    canNavRight,
    handleMobileNav,
    handleDateHeadersScroll,
    handleTechnicianScroll,
    handleMainScroll: handleMainScrollCore,
  };
}
