
import { format, parse, isValid, formatDistanceToNow, startOfDay, endOfDay, isWithinInterval, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Centralized date utilities to standardize date handling throughout the application
 */

// Default timezone for the application
let defaultTimezone = 'Europe/Madrid';

/**
 * Set the application-wide default timezone
 */
export const setDefaultTimezone = (timezone: string) => {
  defaultTimezone = timezone;
};

/**
 * Get the current application-wide default timezone
 */
export const getDefaultTimezone = (): string => {
  return defaultTimezone;
};

/**
 * Format a date with the specified format pattern
 * @param date Date to format
 * @param formatPattern Format pattern (date-fns compatible)
 * @param timezone Optional timezone (defaults to app default)
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | number | string | null | undefined,
  formatPattern = 'yyyy-MM-dd',
  timezone?: string
): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
      
    if (!isValid(dateObj)) return '';
    
    const tz = timezone || defaultTimezone;
    return formatInTimeZone(dateObj, tz, formatPattern);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Format a date in a human-readable format
 */
export const formatReadableDate = (
  date: Date | number | string | null | undefined,
  useSpanish = false
): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
      
    if (!isValid(dateObj)) return '';
    
    return format(dateObj, 'PPP', { locale: useSpanish ? es : undefined });
  } catch (error) {
    console.error('Error formatting readable date:', error);
    return '';
  }
};

/**
 * Format a time in a human-readable format
 */
export const formatTime = (
  date: Date | number | string | null | undefined,
  formatPattern = 'HH:mm',
  timezone?: string
): string => {
  return formatDate(date, formatPattern, timezone);
};

/**
 * Parse a date string with the specified format pattern
 */
export const parseDate = (
  dateString: string | null | undefined, 
  formatPattern = 'yyyy-MM-dd'
): Date | null => {
  if (!dateString) return null;
  
  try {
    const parsedDate = parse(dateString, formatPattern, new Date());
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Get start of day in the specified timezone
 */
export const getStartOfDay = (date: Date | number | string, timezone?: string): Date => {
  const tz = timezone || defaultTimezone;
  const zonedDate = toZonedTime(new Date(date), tz);
  return startOfDay(zonedDate);
};

/**
 * Get end of day in the specified timezone
 */
export const getEndOfDay = (date: Date | number | string, timezone?: string): Date => {
  const tz = timezone || defaultTimezone;
  const zonedDate = toZonedTime(new Date(date), tz);
  return endOfDay(zonedDate);
};

/**
 * Check if a date is within a date range
 */
export const isDateInRange = (
  date: Date | number | string,
  startDate: Date | number | string,
  endDate: Date | number | string
): boolean => {
  try {
    const checkDate = new Date(date);
    return isWithinInterval(checkDate, {
      start: new Date(startDate),
      end: new Date(endDate)
    });
  } catch (error) {
    console.error('Error checking date range:', error);
    return false;
  }
};

/**
 * Get a human-readable representation of time elapsed since the provided date
 */
export const getTimeAgo = (date: Date | number | string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return '';
  }
};

/**
 * Date manipulation functions
 */
export const dateOperations = {
  addDays: (date: Date, days: number): Date => addDays(date, days),
  addWeeks: (date: Date, weeks: number): Date => addWeeks(date, weeks),
  addMonths: (date: Date, months: number): Date => addMonths(date, months),
  subDays: (date: Date, days: number): Date => subDays(date, days),
  subWeeks: (date: Date, weeks: number): Date => subWeeks(date, weeks),
  subMonths: (date: Date, months: number): Date => subMonths(date, months),
  differenceInDays: (dateLeft: Date, dateRight: Date): number => differenceInDays(dateLeft, dateRight),
};

/**
 * Format a date range
 */
export const formatDateRange = (
  startDate: Date | number | string | null | undefined,
  endDate: Date | number | string | null | undefined,
  useSpanish = false
): string => {
  if (!startDate || !endDate) return '';
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (!isValid(start) || !isValid(end)) return '';
    
    const locale = useSpanish ? es : undefined;
    
    // Same day
    if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
      return `${format(start, 'PPP', { locale })}`;
    }
    
    // Same month
    if (format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
      return `${format(start, 'd', { locale })} - ${format(end, 'd', { locale })} ${format(end, 'MMMM yyyy', { locale })}`;
    }
    
    // Same year
    if (format(start, 'yyyy') === format(end, 'yyyy')) {
      return `${format(start, 'd MMM', { locale })} - ${format(end, 'd MMM yyyy', { locale })}`;
    }
    
    // Different years
    return `${format(start, 'd MMM yyyy', { locale })} - ${format(end, 'd MMM yyyy', { locale })}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '';
  }
};
