import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { useDragScroll } from "@/hooks/useDragScroll";

const MADRID_TIMEZONE = "Europe/Madrid";
const MAX_AUTO_SCROLL_RETRIES = 5;

type UseMatrixScrollStateArgs = {
  dates: Date[];
  techniciansLength: number;
  cellWidth: number;
  cellHeight: number;
  /** Width of the sticky technician column, which covers the scroller's left edge. */
  technicianWidth: number;
  /** Height of the sticky date header row, which covers the scroller's top edge. */
  headerHeight: number;
  mobile: boolean;
  isInitialLoading: boolean;
  canExpandBefore: boolean;
  canExpandAfter: boolean;
  onNearEdgeScroll?: (direction: "before" | "after") => void;
};

/**
 * Scroll state for the assignment matrix.
 *
 * The matrix is one scroll container: the date header row and the technician
 * column are `position: sticky` inside it, so the browser moves them with the
 * grid on the compositor. There is no JavaScript on the scroll path beyond
 * scheduling the virtualised window. (It used to be three scrollers kept in
 * step from scroll events, which put a forced layout and a sync frame in every
 * scroll frame and let the headers trail the grid whenever the main thread was
 * busy.)
 *
 * Grid coordinates line up with the scroll offsets: the sticky column and row
 * cover exactly the canvas area that holds them, so the first visible grid
 * column is at scrollLeft and the first visible row at scrollTop.
 */
export const useMatrixScrollState = ({
  dates,
  techniciansLength,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  mobile,
  isInitialLoading,
  canExpandBefore,
  canExpandAfter,
  onNearEdgeScroll,
}: UseMatrixScrollStateArgs) => {
  // The sticky header row and technician column. Not scrollers any more; kept
  // as refs for the elements the view attaches them to.
  const technicianScrollRef = useRef<HTMLDivElement | null>(null);
  const dateHeadersRef = useRef<HTMLDivElement | null>(null);
  // `HTMLDivElement | null` (rather than a bare `RefObject`) so `current` stays
  // writable — the tests assign to it.
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const lastKnownScrollRef = useRef({ left: 0, top: 0 });
  const previousMainScrollLeftRef = useRef<number | null>(null);
  const lastEdgeTriggerRef = useRef({ t: 0 });
  const hasHandledFirstScrollRef = useRef(false);
  const updateScheduledRef = useRef(false);
  const autoScrolledRef = useRef(false);
  const prevDatesRef = useRef<Date[] | null>(null);
  // The cellWidth lastKnownScrollRef.current.left was measured against.
  const previousCellWidthRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const [visibleRows, setVisibleRows] = useState({ start: 0, end: Math.min(techniciansLength - 1, 20) });
  const [visibleCols, setVisibleCols] = useState({ start: 0, end: Math.min(dates.length - 1, 14) });
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

  // Overscan does not reduce how many cells mount per scroll step (the window
  // follows the scroll position exactly); it only adds standing DOM that every
  // style and layout pass walks. A few rows and columns cover a frame of lag.
  const overscanRows = mobile ? 4 : 5;
  // Mobile keeps 4: phone columns are few and wide, and a fast swipe outruns a
  // 2-column margin.
  const overscanCols = mobile ? 4 : 3;

  const updateNavAvailability = useCallback(() => {
    if (!mobile) return;
    const el = mainScrollRef.current;
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
    // The part of the viewport the grid shows, past the sticky row and column.
    const gridViewportHeight = Math.max(0, el.clientHeight - headerHeight);
    const gridViewportWidth = Math.max(0, el.clientWidth - technicianWidth);

    const rowStart = Math.max(0, Math.floor(scrollTop / cellHeight) - overscanRows);
    const rowEnd = Math.min(techniciansLength - 1, Math.floor((scrollTop + gridViewportHeight) / cellHeight) + overscanRows);
    const colStart = Math.max(0, Math.floor(scrollLeft / cellWidth) - overscanCols);
    const colEnd = Math.min(dates.length - 1, Math.floor((scrollLeft + gridViewportWidth) / cellWidth) + overscanCols);

    setVisibleRows((prev) => (prev.start !== rowStart || prev.end !== rowEnd ? { start: rowStart, end: rowEnd } : prev));
    setVisibleCols((prev) => (prev.start !== colStart || prev.end !== colEnd ? { start: colStart, end: colEnd } : prev));
  }, [cellHeight, cellWidth, dates.length, headerHeight, overscanCols, overscanRows, technicianWidth, techniciansLength]);

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
      if (!isMountedRef.current) return;
      updateVisibleWindow();
      updateNavAvailability();
    });
  }, [updateNavAvailability, updateVisibleWindow]);

  useDragScroll(mainScrollRef, {
    enabled: !mobile,
    onScroll: (left, top) => {
      scheduleVisibleWindowUpdate();
      lastKnownScrollRef.current.left = left;
      lastKnownScrollRef.current.top = top;
    },
  });

  const handleMainScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const scrollTop = e.currentTarget.scrollTop;

    // The newest position, which the restore effect must not rewind past.
    lastKnownScrollRef.current.left = scrollLeft;
    lastKnownScrollRef.current.top = scrollTop;

    const previousScrollLeft = previousMainScrollLeftRef.current;
    previousMainScrollLeftRef.current = scrollLeft;
    const horizontalDelta = previousScrollLeft === null ? 0 : scrollLeft - previousScrollLeft;

    if (horizontalDelta !== 0 && onNearEdgeScroll) {
      const scrollElement = e.currentTarget;
      const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
      const now = performance.now();
      const lastEdgeRef = lastEdgeTriggerRef.current;
      if (now - lastEdgeRef.t > 300) {
        if (horizontalDelta < 0 && scrollLeft < 200 && canExpandBefore) {
          onNearEdgeScroll("before");
          lastEdgeRef.t = now;
        } else if (horizontalDelta > 0 && scrollLeft > maxScrollLeft - 200 && canExpandAfter) {
          onNearEdgeScroll("after");
          lastEdgeRef.t = now;
        }
      }
    }

    scheduleVisibleWindowUpdate();
  }, [canExpandAfter, canExpandBefore, onNearEdgeScroll, scheduleVisibleWindowUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      updateScheduledRef.current = false;
    };
  }, []);

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
    const gridViewportWidth = container.clientWidth - technicianWidth;

    if (gridViewportWidth <= 0) {
      return false;
    }

    // Centre today in the part of the viewport the grid shows.
    let scrollPosition = todayIndex * cellWidth - gridViewportWidth / 2 + cellWidth / 2;
    const maxScroll = container.scrollWidth - container.clientWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    container.scrollLeft = scrollPosition;
    // Recorded so the position-restore effect keeps it instead of rewinding.
    lastKnownScrollRef.current.left = container.scrollLeft;
    previousMainScrollLeftRef.current = container.scrollLeft;

    return true;
  }, [cellWidth, dates, technicianWidth]);

  // Crossing the mobile breakpoint changes cellWidth, which invalidates the
  // column the initial scroll landed on — allow it to run again.
  const autoScrolledCellWidthRef = useRef<number | null>(null);
  useEffect(() => {
    if (autoScrolledCellWidthRef.current !== null && autoScrolledCellWidthRef.current !== cellWidth) {
      autoScrolledRef.current = false;
    }
  }, [cellWidth]);

  // A layout effect, so the first paint is already at today: run as a passive
  // effect it landed after the first window was computed for scrollLeft 0,
  // which mounted the opening columns, dropped today's column when the window
  // shrank to the screen, and mounted it again after the jump.
  useLayoutEffect(() => {
    if (autoScrolledRef.current) return;
    if (isInitialLoading || dates.length === 0) return;

    let retries = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const attemptScroll = () => {
      if (cancelled || !isMountedRef.current) return;

      const success = scrollToToday();
      if (success) {
        autoScrolledRef.current = true;
        autoScrolledCellWidthRef.current = cellWidth;
        updateVisibleWindow();
        return;
      }

      retries += 1;
      if (retries < MAX_AUTO_SCROLL_RETRIES && !cancelled) {
        timeoutId = setTimeout(attemptScroll, 100 * retries);
      }
    };

    // Before paint when the scroller already has its size; otherwise retry.
    attemptScroll();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [cellWidth, dates.length, isInitialLoading, scrollToToday, updateVisibleWindow]);

  useEffect(() => {
    updateVisibleWindow();
    hasHandledFirstScrollRef.current = false;
  }, [dates.length, techniciansLength, updateVisibleWindow]);

  useEffect(() => {
    const prev = prevDatesRef.current;
    const main = mainScrollRef.current;
    if (!main || dates.length === 0) {
      // Record the width even with nothing to restore: leaving it unset makes
      // the next run convert the stored offset from the width it is moving to
      // rather than the one it was measured at, which is a no-op conversion.
      previousCellWidthRef.current = cellWidth;
      prevDatesRef.current = dates.slice();
      return;
    }

    const lastLeft = lastKnownScrollRef.current.left ?? main.scrollLeft;
    const lastTop = lastKnownScrollRef.current.top ?? main.scrollTop;

    // Restore in columns, not pixels. This effect also runs when cellWidth
    // changes (crossing the mobile breakpoint, rotating), and the stored offset
    // was measured against the previous width — reapplying it as-is kept the
    // scroll position and moved the date under it. At 120px, column 3 is 360px;
    // re-laid out at 40px the same 360px is column 9.
    const measuredCellWidth = previousCellWidthRef.current ?? cellWidth;
    let targetColumn = measuredCellWidth > 0 ? lastLeft / measuredCellWidth : 0;

    if (prev && prev.length > 0) {
      const prevFirstIso = prev[0].toISOString();
      const nextIndex = dates.findIndex((date) => date.toISOString() === prevFirstIso);

      // Days prepended: the day that was first is now at nextIndex, so the same
      // day sits that many columns further along.
      if (nextIndex > 0) {
        targetColumn += nextIndex;
      }
    }

    const targetLeft = cellWidth > 0 ? targetColumn * cellWidth : lastLeft;

    if (Math.abs(main.scrollLeft - targetLeft) > 1) {
      main.scrollLeft = targetLeft;
    }
    if (Math.abs(main.scrollTop - lastTop) > 1) {
      main.scrollTop = lastTop;
    }

    lastKnownScrollRef.current.left = targetLeft;
    lastKnownScrollRef.current.top = lastTop;
    previousMainScrollLeftRef.current = targetLeft;
    // The offset above is now expressed in the current width, so that is what
    // the next run must convert from.
    previousCellWidthRef.current = cellWidth;
    prevDatesRef.current = dates.slice();
  }, [cellWidth, dates]);

  useEffect(() => {
    if (!mobile) return;
    const updateStep = () => {
      const w = (mainScrollRef.current?.clientWidth || 0) - technicianWidth;
      const cols = Math.max(3, Math.min(4, Math.floor(w / cellWidth)) || 3);
      setNavStep(cols);
    };
    updateStep();
    window.addEventListener("resize", updateStep);
    return () => window.removeEventListener("resize", updateStep);
  }, [cellWidth, mobile, technicianWidth]);

  useEffect(() => {
    if (!mobile) return;
    updateNavAvailability();
  }, [dates.length, mobile, updateNavAvailability, visibleCols]);

  const handleMobileNav = useCallback((dir: "left" | "right") => {
    const main = mainScrollRef.current;
    if (!main) return;
    const delta = navStep * cellWidth * (dir === "left" ? -1 : 1);
    const target = Math.max(0, Math.min(main.scrollLeft + delta, main.scrollWidth - main.clientWidth));
    main.scrollTo({ left: target, top: main.scrollTop, behavior: "smooth" });
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
    handleMainScroll,
  };
};
