import { useState, useMemo, useCallback } from 'react';
import { addDays, addWeeks, addMonths, format, isSameDay, startOfDay } from 'date-fns';

interface DateRangeState {
  centerDate: Date;
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

export const useVirtualizedDateRange = (options: UseVirtualizedDateRangeOptions = {}) => {
  const {
    initialWeeksBefore = 1,
    initialWeeksAfter = 2,
    maxWeeksBefore = 26, // 6 months
    maxWeeksAfter = 26,  // 6 months
    expandByWeeks = 4    // Expand by 4 weeks at a time
  } = options;

  const [dateState, setDateState] = useState<DateRangeState>({
    centerDate: startOfDay(new Date()),
    weeksBefore: initialWeeksBefore,
    weeksAfter: initialWeeksAfter,
    maxWeeksBefore,
    maxWeeksAfter
  });

  // Generate the current date range
  const dateRange = useMemo(() => {
    const startDate = addWeeks(dateState.centerDate, -dateState.weeksBefore);
    const endDate = addWeeks(dateState.centerDate, dateState.weeksAfter);
    
    const dates = [];
    let currentDate = startDate;
    
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  }, [dateState]);

  // Get today's index in the current range
  const todayIndex = useMemo(() => {
    const today = new Date();
    return dateRange.findIndex(date => isSameDay(date, today));
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
      centerDate: startOfDay(date)
    }));
  }, []);

  // Reset to initial state
  const resetRange = useCallback(() => {
    setDateState({
      centerDate: startOfDay(new Date()),
      weeksBefore: initialWeeksBefore,
      weeksAfter: initialWeeksAfter,
      maxWeeksBefore,
      maxWeeksAfter
    });
  }, [initialWeeksBefore, initialWeeksAfter, maxWeeksBefore, maxWeeksAfter]);

  // Jump to a specific month/year
  const jumpToMonth = useCallback((year: number, month: number) => {
    const targetDate = new Date(year, month - 1, 1); // month is 0-indexed
    setCenterDate(targetDate);
  }, [setCenterDate]);

  // Get range metadata
  const rangeInfo = useMemo(() => {
    const start = dateRange[0];
    const end = dateRange[dateRange.length - 1];
    const totalWeeks = dateState.weeksBefore + dateState.weeksAfter;
    const totalDays = dateRange.length;
    
    return {
      start,
      end,
      totalWeeks,
      totalDays,
      startFormatted: start ? format(start, 'MMM d, yyyy') : '',
      endFormatted: end ? format(end, 'MMM d, yyyy') : '',
      isAtMaxBefore: dateState.weeksBefore >= dateState.maxWeeksBefore,
      isAtMaxAfter: dateState.weeksAfter >= dateState.maxWeeksAfter
    };
  }, [dateRange, dateState]);

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
    currentState: dateState
  };
};