import { useState, useMemo, useCallback } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

import {
  MADRID_TIMEZONE,
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
} from '@/utils/timezoneUtils';

/**
 * The range is defined in Madrid calendar days, not browser-local ones.
 *
 * State is held as `yyyy-MM-dd` Madrid keys and only converted to Date at the
 * edges, where each Date is the *instant* of that Madrid midnight. Consumers
 * therefore get the same day from `formatMadridDateKey(date)` in every
 * timezone. Deriving the range from local midnights instead used to make the
 * column a browser east or west of Madrid displayed disagree with the day its
 * data was keyed and submitted under.
 */
interface DateRangeState {
  centerDateKey: string;
  weeksBefore: number;
  weeksAfter: number;
  maxWeeksBefore: number;
  maxWeeksAfter: number;
}

interface UseVirtualizedDateRangeOptions {
  initialWeeksBefore?: number;
  initialWeeksAfter?: number;
  maxWeeksBefore?: number;
  maxWeeksAfter?: number;
  expandByWeeks?: number;
}

const madridTodayKey = () => formatMadridDateKey(new Date());

/** Inclusive run of Madrid day keys. Steps calendar days, so DST is handled. */
const buildDateKeys = (startKey: string, endKey: string): string[] => {
  const keys: string[] = [];
  let key = startKey;
  while (key <= endKey) {
    keys.push(key);
    const next = addMadridCalendarDays(key, 1);
    if (next === key) break;
    key = next;
  }
  return keys;
};

export const useVirtualizedDateRange = (options: UseVirtualizedDateRangeOptions = {}) => {
  const {
    initialWeeksBefore = 1,
    initialWeeksAfter = 2,
    maxWeeksBefore = 26, // 6 months
    maxWeeksAfter = 26,  // 6 months
    expandByWeeks = 4    // Expand by 4 weeks at a time
  } = options;

  const [dateState, setDateState] = useState<DateRangeState>(() => ({
    centerDateKey: madridTodayKey(),
    weeksBefore: initialWeeksBefore,
    weeksAfter: initialWeeksAfter,
    maxWeeksBefore,
    maxWeeksAfter
  }));

  const buildRangeInfo = useCallback((state: DateRangeState) => {
    const startKey = addMadridCalendarDays(state.centerDateKey, -state.weeksBefore * 7);
    const endKey = addMadridCalendarDays(state.centerDateKey, state.weeksAfter * 7);
    const start = fromMadridDateKey(startKey);
    const end = fromMadridDateKey(endKey);

    return {
      start,
      end,
      startKey,
      endKey,
      totalWeeks: state.weeksBefore + state.weeksAfter,
      totalDays: buildDateKeys(startKey, endKey).length,
      startFormatted: formatInTimeZone(start, MADRID_TIMEZONE, 'MMM d, yyyy'),
      endFormatted: formatInTimeZone(end, MADRID_TIMEZONE, 'MMM d, yyyy'),
      isAtMaxBefore: state.weeksBefore >= state.maxWeeksBefore,
      isAtMaxAfter: state.weeksAfter >= state.maxWeeksAfter,
    };
  }, []);

  // Generate the current date range
  const dateRange = useMemo(() => {
    const startKey = addMadridCalendarDays(dateState.centerDateKey, -dateState.weeksBefore * 7);
    const endKey = addMadridCalendarDays(dateState.centerDateKey, dateState.weeksAfter * 7);
    return buildDateKeys(startKey, endKey).map((key) => fromMadridDateKey(key));
  }, [dateState]);

  // Get today's index in the current range
  const todayIndex = useMemo(() => {
    const todayKey = madridTodayKey();
    return dateRange.findIndex((date) => formatMadridDateKey(date) === todayKey);
  }, [dateRange]);

  // Check if we can expand in either direction
  const canExpandBefore = dateState.weeksBefore < dateState.maxWeeksBefore;
  const canExpandAfter = dateState.weeksAfter < dateState.maxWeeksAfter;

  // Expand the range backwards (earlier dates)
  const expandBefore = useCallback(() => {
    if (!canExpandBefore) return false;

    setDateState(prev => ({
      ...prev,
      weeksBefore: Math.min(prev.weeksBefore + expandByWeeks, prev.maxWeeksBefore)
    }));

    return true;
  }, [canExpandBefore, expandByWeeks]);

  // Expand the range forwards (later dates)
  const expandAfter = useCallback(() => {
    if (!canExpandAfter) return false;

    setDateState(prev => ({
      ...prev,
      weeksAfter: Math.min(prev.weeksAfter + expandByWeeks, prev.maxWeeksAfter)
    }));

    return true;
  }, [canExpandAfter, expandByWeeks]);

  // Set a specific center date (useful for jumping to different time periods)
  const setCenterDate = useCallback((date: Date) => {
    setDateState(prev => ({
      ...prev,
      centerDateKey: formatMadridDateKey(date)
    }));
  }, []);

  // Reset to initial state
  const resetRange = useCallback(() => {
    setDateState({
      centerDateKey: madridTodayKey(),
      weeksBefore: initialWeeksBefore,
      weeksAfter: initialWeeksAfter,
      maxWeeksBefore,
      maxWeeksAfter
    });
  }, [initialWeeksBefore, initialWeeksAfter, maxWeeksBefore, maxWeeksAfter]);

  // Jump to a specific month/year
  const jumpToMonth = useCallback((year: number, month: number) => {
    // month is 1-indexed; the range centres on the first of that Madrid month.
    const centerDateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
    setDateState(prev => ({ ...prev, centerDateKey }));
  }, []);

  // Get range metadata
  const rangeInfo = useMemo(() => buildRangeInfo(dateState), [buildRangeInfo, dateState]);

  const getProjectedRangeInfo = useCallback((direction: 'before' | 'after', steps = 1) => {
    if (steps <= 0) return null;

    const delta = steps * expandByWeeks;
    let nextWeeksBefore = dateState.weeksBefore;
    let nextWeeksAfter = dateState.weeksAfter;

    if (direction === 'before') {
      if (!canExpandBefore) return null;
      nextWeeksBefore = Math.min(dateState.weeksBefore + delta, dateState.maxWeeksBefore);
      if (nextWeeksBefore === dateState.weeksBefore) return null;
    } else {
      if (!canExpandAfter) return null;
      nextWeeksAfter = Math.min(dateState.weeksAfter + delta, dateState.maxWeeksAfter);
      if (nextWeeksAfter === dateState.weeksAfter) return null;
    }

    const projectedState: DateRangeState = {
      ...dateState,
      weeksBefore: nextWeeksBefore,
      weeksAfter: nextWeeksAfter,
    };

    return {
      state: projectedState,
      rangeInfo: buildRangeInfo(projectedState),
    };
  }, [buildRangeInfo, canExpandAfter, canExpandBefore, dateState, expandByWeeks]);

  return {
    dateRange,
    todayIndex,
    canExpandBefore,
    canExpandAfter,
    expandBefore,
    expandAfter,
    setCenterDate,
    resetRange,
    jumpToMonth,
    rangeInfo,
    currentState: dateState,
    getProjectedRangeInfo,
  };
};
