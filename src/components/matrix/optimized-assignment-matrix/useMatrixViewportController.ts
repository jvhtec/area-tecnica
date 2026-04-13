import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSameDay } from "date-fns";

import { useDragScroll } from "@/hooks/useDragScroll";
import { throttle } from "@/utils/throttle";

import type { MatrixViewportState } from "./types";

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
  const lastKnownScrollRef = useRef({ left: 0, top: 0 });
  const autoScrolledRef = useRef(false);
  const hasHandledFirstScrollRef = useRef(false);
  const updateScheduledRef = useRef(false);
  const previousScrollLeftRef = useRef<number | null>(null);
  const lastEdgeTriggerRef = useRef(0);
  const previousDatesRef = useRef<Date[] | null>(null);

  const [visibleRows, setVisibleRows] = useState({
    start: 0,
    end: Math.min(technicianCount - 1, 20),
  });
  const [visibleCols, setVisibleCols] = useState({
    start: 0,
    end: Math.min(dates.length - 1, 14),
  });
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

  const matrixWidth = useMemo(() => dates.length * cellWidth, [dates.length, cellWidth]);
  const matrixHeight = useMemo(() => technicianCount * cellHeight, [technicianCount, cellHeight]);
  const overscanRows = mobile ? 6 : 10;
  const overscanCols = mobile ? 4 : 6;

  const syncScrollPositions = useCallback((scrollLeft: number, scrollTop: number, source: "main" | "dateHeaders" | "technician") => {
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    requestAnimationFrame(() => {
      try {
        if (source !== "dateHeaders" && dateHeadersRef.current) {
          dateHeadersRef.current.scrollLeft = scrollLeft;
        }
        if (source !== "main" && mainScrollRef.current) {
          mainScrollRef.current.scrollLeft = scrollLeft;
          mainScrollRef.current.scrollTop = scrollTop;
        }
        if (source !== "technician" && technicianScrollRef.current) {
          technicianScrollRef.current.scrollTop = scrollTop;
        }
      } finally {
        syncInProgressRef.current = false;
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

  const updateVisibleWindow = useCallback(() => {
    const element = mainScrollRef.current;
    if (!element) return;

    const rowStart = Math.max(0, Math.floor(element.scrollTop / cellHeight) - overscanRows);
    const rowEnd = Math.min(
      technicianCount - 1,
      Math.floor((element.scrollTop + element.clientHeight) / cellHeight) + overscanRows,
    );
    const colStart = Math.max(0, Math.floor(element.scrollLeft / cellWidth) - overscanCols);
    const colEnd = Math.min(
      dates.length - 1,
      Math.floor((element.scrollLeft + element.clientWidth) / cellWidth) + overscanCols,
    );

    setVisibleRows((previous) =>
      previous.start !== rowStart || previous.end !== rowEnd
        ? { start: rowStart, end: rowEnd }
        : previous,
    );
    setVisibleCols((previous) =>
      previous.start !== colStart || previous.end !== colEnd
        ? { start: colStart, end: colEnd }
        : previous,
    );
  }, [cellHeight, cellWidth, dates.length, overscanCols, overscanRows, technicianCount]);

  const scheduleVisibleWindowUpdate = useCallback(() => {
    if (!hasHandledFirstScrollRef.current) {
      hasHandledFirstScrollRef.current = true;
      updateVisibleWindow();
      return;
    }

    if (updateScheduledRef.current) return;
    updateScheduledRef.current = true;

    requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updateVisibleWindow();
    });
  }, [updateVisibleWindow]);

  useDragScroll(mainScrollRef, {
    enabled: !mobile,
    onScroll: (left, top) => {
      syncScrollPositions(left, top, "main");
      scheduleVisibleWindowUpdate();
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
        scheduleVisibleWindowUpdate();
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
      scheduleVisibleWindowUpdate();
    },
    [canExpandAfter, canExpandBefore, onNearEdgeScroll, scheduleVisibleWindowUpdate, syncScrollPositions],
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
      scheduleVisibleWindowUpdate();
    },
    [scheduleVisibleWindowUpdate, syncScrollPositions],
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
    };
  }, [handleDateHeadersScroll]);

  const scrollToToday = useCallback(() => {
    const container = mainScrollRef.current;
    if (!container || dates.length === 0) return false;

    const todayIndex = dates.findIndex((date) => isSameDay(date, new Date()));
    if (todayIndex === -1 || container.clientWidth === 0) return false;

    let scrollPosition = todayIndex * cellWidth - container.clientWidth / 2 + cellWidth / 2;
    const maxScroll = matrixWidth - container.clientWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    container.scrollLeft = scrollPosition;

    return true;
  }, [cellWidth, dates, matrixWidth]);

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
    updateVisibleWindow();
    hasHandledFirstScrollRef.current = false;
  }, [technicianCount, dates.length, updateVisibleWindow]);

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
      const previousFirstIso = previousDates[0]?.toISOString();
      const nextIndex = dates.findIndex((date) => date.toISOString() === previousFirstIso);
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
  }, [cellWidth, dates]);

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
