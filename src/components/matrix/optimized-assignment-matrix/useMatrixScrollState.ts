import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { useDragScroll } from "@/hooks/useDragScroll";
import { throttle } from "@/utils/throttle";

const MADRID_TIMEZONE = "Europe/Madrid";
const MAX_AUTO_SCROLL_RETRIES = 5;

type UseMatrixScrollStateArgs = {
  dates: Date[];
  techniciansLength: number;
  cellWidth: number;
  cellHeight: number;
  matrixWidth: number;
  mobile: boolean;
  isInitialLoading: boolean;
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  onNearEdgeScroll?: (direction: "before" | "after") => void;
};

export const useMatrixScrollState = ({
  dates,
  techniciansLength,
  cellWidth,
  cellHeight,
  matrixWidth,
  mobile,
  isInitialLoading,
  canExpandBefore,
  canExpandAfter,
  onNearEdgeScroll,
}: UseMatrixScrollStateArgs) => {
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const syncInProgressRef = useRef(false);
  const lastKnownScrollRef = useRef({ left: 0, top: 0 });
  const previousMainScrollLeftRef = useRef<number | null>(null);
  const lastEdgeTriggerRef = useRef({ t: 0 });
  const hasHandledFirstScrollRef = useRef(false);
  const updateScheduledRef = useRef(false);
  const autoScrolledRef = useRef(false);
  const prevDatesRef = useRef<Date[] | null>(null);

  const [visibleRows, setVisibleRows] = useState({ start: 0, end: Math.min(techniciansLength - 1, 20) });
  const [visibleCols, setVisibleCols] = useState({ start: 0, end: Math.min(dates.length - 1, 14) });
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

  const overscanRows = mobile ? 6 : 10;
  const overscanCols = mobile ? 4 : 6;

  const syncScrollPositions = useCallback((scrollLeft: number, scrollTop: number, source: string) => {
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;

    requestAnimationFrame(() => {
      try {
        if (source !== "dateHeaders" && dateHeadersRef.current) {
          dateHeadersRef.current.scrollLeft = scrollLeft;
        }
        if (source !== "main" && mainScrollRef.current) {
          mainScrollRef.current.scrollLeft = scrollLeft;
        }
        if (source !== "technician" && technicianScrollRef.current) {
          technicianScrollRef.current.scrollTop = scrollTop;
        }
        if (source !== "main" && mainScrollRef.current) {
          mainScrollRef.current.scrollTop = scrollTop;
        }
      } finally {
        syncInProgressRef.current = false;
      }
    });
  }, []);

  const updateNavAvailability = useCallback(() => {
    if (!mobile) return;
    const el = dateHeadersRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth - 1;
    setCanNavLeft(sl > 2);
    setCanNavRight(sl < max);
  }, [mobile]);

  const updateVisibleWindow = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const scrollLeft = el.scrollLeft;
    const clientH = el.clientHeight;
    const clientW = el.clientWidth;

    const rowStart = Math.max(0, Math.floor(scrollTop / cellHeight) - overscanRows);
    const rowEnd = Math.min(techniciansLength - 1, Math.floor((scrollTop + clientH) / cellHeight) + overscanRows);
    const colStart = Math.max(0, Math.floor(scrollLeft / cellWidth) - overscanCols);
    const colEnd = Math.min(dates.length - 1, Math.floor((scrollLeft + clientW) / cellWidth) + overscanCols);

    setVisibleRows((prev) => (prev.start !== rowStart || prev.end !== rowEnd ? { start: rowStart, end: rowEnd } : prev));
    setVisibleCols((prev) => (prev.start !== colStart || prev.end !== colEnd ? { start: colStart, end: colEnd } : prev));
  }, [cellHeight, cellWidth, dates.length, overscanCols, overscanRows, techniciansLength]);

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
      lastKnownScrollRef.current.left = left;
      lastKnownScrollRef.current.top = top;
    },
  });

  const handleMainScrollCore = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    const scrollTop = e.currentTarget.scrollTop;

    const previousScrollLeft = previousMainScrollLeftRef.current;
    const horizontalDelta = previousScrollLeft === null ? 0 : scrollLeft - previousScrollLeft;
    const movedHorizontally = previousScrollLeft !== null && horizontalDelta !== 0;

    if (previousScrollLeft !== null && !movedHorizontally) {
      syncScrollPositions(scrollLeft, scrollTop, "main");
      scheduleVisibleWindowUpdate();
      return;
    }

    previousMainScrollLeftRef.current = scrollLeft;

    const movingTowardLeftEdge = movedHorizontally && horizontalDelta < 0;
    const movingTowardRightEdge = movedHorizontally && horizontalDelta > 0;
    const scrollElement = e.currentTarget;
    const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
    const nearLeftEdge = scrollLeft < 200;
    const nearRightEdge = scrollLeft > maxScrollLeft - 200;

    const now = performance.now();
    const lastEdgeRef = lastEdgeTriggerRef.current;
    if (movedHorizontally && now - lastEdgeRef.t > 300) {
      if (movingTowardLeftEdge && nearLeftEdge && canExpandBefore && onNearEdgeScroll) {
        onNearEdgeScroll("before");
        lastEdgeRef.t = now;
      } else if (movingTowardRightEdge && nearRightEdge && canExpandAfter && onNearEdgeScroll) {
        onNearEdgeScroll("after");
        lastEdgeRef.t = now;
      }
    }

    syncScrollPositions(scrollLeft, scrollTop, "main");
    lastKnownScrollRef.current.left = scrollLeft;
    lastKnownScrollRef.current.top = scrollTop;
    scheduleVisibleWindowUpdate();
  }, [
    canExpandAfter,
    canExpandBefore,
    onNearEdgeScroll,
    scheduleVisibleWindowUpdate,
    syncScrollPositions,
  ]);

  const handleDateHeadersScrollCore = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    syncScrollPositions(scrollLeft, mainScrollRef.current?.scrollTop || 0, "dateHeaders");
    lastKnownScrollRef.current.left = scrollLeft;
    updateNavAvailability();
  }, [syncScrollPositions, updateNavAvailability]);

  const handleTechnicianScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    syncScrollPositions(mainScrollRef.current?.scrollLeft || 0, scrollTop, "technician");
    lastKnownScrollRef.current.top = scrollTop;
    scheduleVisibleWindowUpdate();
  }, [scheduleVisibleWindowUpdate, syncScrollPositions]);

  const handleMainScroll = handleMainScrollCore;
  const handleDateHeadersScroll = useMemo(
    () => throttle(handleDateHeadersScrollCore, 12),
    [handleDateHeadersScrollCore],
  );

  useEffect(() => () => {
    handleDateHeadersScroll.cancel();
  }, [handleDateHeadersScroll, handleMainScroll, handleTechnicianScroll]);

  const scrollToToday = useCallback(() => {
    if (!mainScrollRef.current || dates.length === 0) {
      return false;
    }

    const todayKey = formatInTimeZone(new Date(), MADRID_TIMEZONE, "yyyy-MM-dd");
    const todayIndex = dates.findIndex(
      (date) => formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd") === todayKey,
    );

    if (todayIndex === -1) {
      return false;
    }

    const container = mainScrollRef.current;
    const containerWidth = container.clientWidth;

    if (containerWidth === 0) {
      return false;
    }

    let scrollPosition = (todayIndex * cellWidth) - (containerWidth / 2) + (cellWidth / 2);
    const maxScroll = matrixWidth - containerWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    container.scrollLeft = scrollPosition;
    requestAnimationFrame(() => { /* verify next frame (no-op) */ });

    return true;
  }, [cellWidth, dates, matrixWidth]);

  useEffect(() => {
    if (autoScrolledRef.current) return;
    if (isInitialLoading || dates.length === 0) return;

    let retries = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const attemptScroll = () => {
      const success = scrollToToday();
      if (success) {
        autoScrolledRef.current = true;
        return;
      }

      retries += 1;
      if (retries < MAX_AUTO_SCROLL_RETRIES) {
        timeoutId = setTimeout(attemptScroll, 100 * retries);
      }
    };

    timeoutId = setTimeout(attemptScroll, 50);
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [dates.length, isInitialLoading, scrollToToday]);

  useEffect(() => {
    updateVisibleWindow();
    hasHandledFirstScrollRef.current = false;
  }, [dates.length, scheduleVisibleWindowUpdate, techniciansLength, updateVisibleWindow]);

  useEffect(() => {
    const prev = prevDatesRef.current;
    const main = mainScrollRef.current;
    const headers = dateHeadersRef.current;
    const technicianScroller = technicianScrollRef.current;
    if (!main || dates.length === 0) {
      prevDatesRef.current = dates.slice();
      return;
    }

    const lastLeft = lastKnownScrollRef.current.left ?? main.scrollLeft;
    const lastTop = lastKnownScrollRef.current.top ?? main.scrollTop;
    let targetLeft = lastLeft;

    if (prev && prev.length > 0) {
      const prevFirstIso = prev[0].toISOString();
      const nextIndex = dates.findIndex((date) => date.toISOString() === prevFirstIso);

      if (nextIndex > 0) {
        targetLeft = lastLeft + nextIndex * cellWidth;
      } else if (nextIndex === -1) {
        targetLeft = lastLeft;
      }
    }

    const applyScroll = (element: HTMLDivElement | null, value: number) => {
      if (!element) return;
      if (Math.abs(element.scrollLeft - value) > 1) {
        element.scrollLeft = value;
      }
    };

    applyScroll(main, targetLeft);
    applyScroll(headers, targetLeft);
    if (technicianScroller && Math.abs(technicianScroller.scrollTop - lastTop) > 1) {
      technicianScroller.scrollTop = lastTop;
    }
    if (Math.abs(main.scrollTop - lastTop) > 1) {
      main.scrollTop = lastTop;
    }

    lastKnownScrollRef.current.left = targetLeft;
    lastKnownScrollRef.current.top = lastTop;
    previousMainScrollLeftRef.current = targetLeft;
    prevDatesRef.current = dates.slice();
  }, [cellWidth, dates]);

  useEffect(() => {
    if (!mobile) return;
    const updateStep = () => {
      const w = dateHeadersRef.current?.clientWidth || 0;
      const cols = Math.max(3, Math.min(4, Math.floor(w / cellWidth)) || 3);
      setNavStep(cols);
    };
    updateStep();
    window.addEventListener("resize", updateStep);
    return () => window.removeEventListener("resize", updateStep);
  }, [cellWidth, mobile]);

  useEffect(() => {
    if (!mobile) return;
    updateNavAvailability();
  }, [dates.length, mobile, updateNavAvailability, visibleCols]);

  const handleMobileNav = useCallback((dir: "left" | "right") => {
    const el = dateHeadersRef.current;
    const main = mainScrollRef.current;
    if (!el || !main) return;
    const delta = navStep * cellWidth * (dir === "left" ? -1 : 1);
    const target = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth - el.clientWidth));
    el.scrollTo({ left: target, behavior: "smooth" });
    main.scrollTo({ left: target, top: main.scrollTop, behavior: "smooth" as ScrollBehavior });
  }, [cellWidth, navStep]);

  return {
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
    handleMainScroll,
  };
};
