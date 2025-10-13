
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone, zonedTimeToUtc } from "date-fns-tz";

/**
 * Convert a UTC date to a specific timezone
 */
export const toJobTimezone = (date: Date | string, timezone: string = 'Europe/Madrid'): Date => {
  const utcDate = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(utcDate, timezone);
};

/**
 * Convert a date from a specific timezone to UTC
 */
export const fromJobTimezone = (date: Date, timezone: string = 'Europe/Madrid'): Date => {
  return fromZonedTime(date, timezone);
};

/**
 * Format a date in a specific timezone
 */
export const formatInJobTimezone = (
  date: Date | string, 
  formatStr: string, 
  timezone: string = 'Europe/Madrid'
): string => {
  const utcDate = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(utcDate, timezone, formatStr);
};

/**
 * Get start and end of day in a specific timezone
 */
export const getDayBoundsInTimezone = (date: Date, timezone: string = 'Europe/Madrid') => {
  const zonedDate = toJobTimezone(date, timezone);
  const startOfDayLocal = startOfDay(zonedDate);
  const endOfDayLocal = endOfDay(zonedDate);
  
  return {
    start: fromJobTimezone(startOfDayLocal, timezone),
    end: fromJobTimezone(endOfDayLocal, timezone)
  };
};

/**
 * Check if a UTC job time falls within a local date
 */
export const isJobOnDate = (
  jobStartUTC: string | Date, 
  jobEndUTC: string | Date, 
  localDate: Date, 
  jobTimezone: string = 'Europe/Madrid'
): boolean => {
  const { start: dayStartUTC, end: dayEndUTC } = getDayBoundsInTimezone(localDate, jobTimezone);
  
  const jobStart = typeof jobStartUTC === 'string' ? parseISO(jobStartUTC) : jobStartUTC;
  const jobEnd = typeof jobEndUTC === 'string' ? parseISO(jobEndUTC) : jobEndUTC;
  
  // Check if job overlaps with the day
  return jobStart <= dayEndUTC && jobEnd >= dayStartUTC;
};

/**
 * Convert datetime-local input value to UTC date considering job timezone
 */
export const localInputToUTC = (localDateTimeString: string, timezone: string = 'Europe/Madrid'): Date => {
  // Interpret the provided datetime string as a wall-clock time in the job's timezone
  return zonedTimeToUtc(localDateTimeString, timezone);
};

/**
 * Convert UTC date to datetime-local input value in job timezone
 */
export const utcToLocalInput = (utcDate: Date | string, timezone: string = 'Europe/Madrid'): string => {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const zonedDate = toJobTimezone(date, timezone);
  
  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  return format(zonedDate, "yyyy-MM-dd'T'HH:mm");
};
