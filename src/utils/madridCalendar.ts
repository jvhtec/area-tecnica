/**
 * Utilities for working with Comunidad de Madrid working days calendar
 *
 * This module provides functions to determine if a date is a working day
 * according to the Comunidad de Madrid calendar (excluding weekends and regional holidays).
 *
 * Used primarily for warehouse day scheduling for house techs.
 */

import { format, isWeekend, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';

export interface MadridHoliday {
  id: string;
  date: string; // YYYY-MM-DD format
  name: string;
  year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches all Madrid holidays from the database
 * @param year Optional year to filter holidays (defaults to all years)
 * @returns Array of Madrid holidays
 */
export async function fetchMadridHolidays(year?: number): Promise<MadridHoliday[]> {
  try {
    let query = supabase
      .from('madrid_holidays')
      .select('*')
      .eq('is_active', true)
      .order('date');

    if (year !== undefined) {
      query = query.eq('year', year);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching Madrid holidays:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in fetchMadridHolidays:', error);
    return [];
  }
}

/**
 * Checks if a given date is a Madrid working day (not weekend, not holiday)
 * @param date Date to check (Date object or YYYY-MM-DD string)
 * @param holidays Array of Madrid holidays (if not provided, will fetch from DB)
 * @returns Promise<boolean> true if it's a working day
 */
export async function isMadridWorkingDay(
  date: Date | string,
  holidays?: MadridHoliday[]
): Promise<boolean> {
  // Convert to Date object if string
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  // Check if weekend
  if (isWeekend(dateObj)) {
    return false;
  }

  // Format date as YYYY-MM-DD
  const dateStr = format(dateObj, 'yyyy-MM-dd');

  // If holidays not provided, fetch them
  if (!holidays) {
    holidays = await fetchMadridHolidays();
  }

  // Check if it's a holiday
  const isHoliday = holidays.some(h => h.date === dateStr);

  return !isHoliday;
}

/**
 * Client-side check if a date is a Madrid working day (synchronous version)
 * Note: This requires the holidays array to be pre-loaded
 * @param date Date to check (Date object or YYYY-MM-DD string)
 * @param holidays Array of Madrid holidays (required)
 * @returns boolean true if it's a working day
 */
export function isMadridWorkingDaySync(
  date: Date | string,
  holidays: MadridHoliday[]
): boolean {
  // Convert to Date object if string
  const dateObj = typeof date === 'string' ? parseISO(date) : date;

  // Check if weekend
  if (isWeekend(dateObj)) {
    return false;
  }

  // Format date as YYYY-MM-DD
  const dateStr = format(dateObj, 'yyyy-MM-dd');

  // Check if it's a holiday
  const isHoliday = holidays.some(h => h.date === dateStr);

  return !isHoliday;
}

/**
 * Gets the holiday name for a given date (if it's a holiday)
 * @param date Date to check (Date object or YYYY-MM-DD string)
 * @param holidays Array of Madrid holidays
 * @returns Holiday name or null if not a holiday
 */
export function getMadridHolidayName(
  date: Date | string,
  holidays: MadridHoliday[]
): string | null {
  // Convert to Date object if string, then format to ensure consistent YYYY-MM-DD format
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const dateStr = format(dateObj, 'yyyy-MM-dd');

  // Find the holiday
  const holiday = holidays.find(h => h.date === dateStr);

  return holiday ? holiday.name : null;
}

/**
 * Checks if a date is a weekend
 * @param date Date to check (Date object or YYYY-MM-DD string)
 * @returns boolean true if weekend
 */
export function isWeekendDay(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return isWeekend(dateObj);
}
