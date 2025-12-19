/**
 * React hook for managing Comunidad de Madrid holidays
 *
 * Provides access to Madrid regional holidays and working day checks.
 * Automatically loads holidays and caches them for the session.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  fetchMadridHolidays,
  isMadridWorkingDaySync,
  getMadridHolidayName,
  isWeekendDay,
  type MadridHoliday
} from '@/utils/madridCalendar';

interface UseMadridHolidaysReturn {
  holidays: MadridHoliday[];
  loading: boolean;
  error: Error | null;
  isWorkingDay: (date: Date | string) => boolean;
  isWeekend: (date: Date | string) => boolean;
  getHolidayName: (date: Date | string) => string | null;
  isNonWorkingDay: (date: Date | string) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage Madrid holidays and working day checks
 * @param yearFilter Optional year to filter holidays (defaults to all years)
 * @returns Object with holidays data and utility functions
 */
export function useMadridHolidays(yearFilter?: number): UseMadridHolidaysReturn {
  const [holidays, setHolidays] = useState<MadridHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadHolidays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMadridHolidays(yearFilter);
      setHolidays(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load Madrid holidays'));
      console.error('Error loading Madrid holidays:', err);
    } finally {
      setLoading(false);
    }
  }, [yearFilter]);

  useEffect(() => {
    loadHolidays();
  }, [loadHolidays]);

  const isWorkingDay = useCallback((date: Date | string): boolean => {
    if (loading || holidays.length === 0) {
      // Fallback: just check weekends if holidays not loaded yet
      return !isWeekendDay(date);
    }
    return isMadridWorkingDaySync(date, holidays);
  }, [holidays, loading]);

  const isWeekend = useCallback((date: Date | string): boolean => {
    return isWeekendDay(date);
  }, []);

  const getHolidayName = useCallback((date: Date | string): string | null => {
    return getMadridHolidayName(date, holidays);
  }, [holidays]);

  const isNonWorkingDay = useCallback((date: Date | string): boolean => {
    return !isWorkingDay(date);
  }, [isWorkingDay]);

  return {
    holidays,
    loading,
    error,
    isWorkingDay,
    isWeekend,
    getHolidayName,
    isNonWorkingDay,
    refresh: loadHolidays
  };
}
