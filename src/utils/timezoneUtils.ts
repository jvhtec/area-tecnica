
import { addDays, format, parseISO, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const MADRID_TIMEZONE = "Europe/Madrid";

/**
 * Convert a UTC date to a specific timezone
 */
export const toJobTimezone = (date: Date | string, timezone: string = MADRID_TIMEZONE): Date => {
  const utcDate = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(utcDate, timezone);
};

/**
 * Convert a date from a specific timezone to UTC
 */
export const fromJobTimezone = (date: Date, timezone: string = MADRID_TIMEZONE): Date => {
  return fromZonedTime(date, timezone);
};

/**
 * Format a date in a specific timezone
 */
export const formatInJobTimezone = (
  date: Date | string, 
  formatStr: string, 
  timezone: string = MADRID_TIMEZONE
): string => {
  const utcDate = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(utcDate, timezone, formatStr);
};

/**
 * Get start and end of day in a specific timezone
 */
export const getDayBoundsInTimezone = (date: Date, timezone: string = MADRID_TIMEZONE) => {
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
  jobTimezone: string = MADRID_TIMEZONE
): boolean => {
  // Guard against null/undefined dates
  if (!jobStartUTC || !jobEndUTC) return false;

  const { start: dayStartUTC, end: dayEndUTC } = getDayBoundsInTimezone(localDate, jobTimezone);

  const jobStart = typeof jobStartUTC === 'string' ? parseISO(jobStartUTC) : jobStartUTC;
  const jobEnd = typeof jobEndUTC === 'string' ? parseISO(jobEndUTC) : jobEndUTC;

  // Check if dates are valid
  if (isNaN(jobStart.getTime()) || isNaN(jobEnd.getTime())) return false;

  // Check if job overlaps with the day
  return jobStart <= dayEndUTC && jobEnd >= dayStartUTC;
};

/**
 * Convert datetime-local input value to UTC date considering job timezone
 */
export const localInputToUTC = (localDateTimeString: string, timezone: string = MADRID_TIMEZONE): Date => {
  // Interpret the provided datetime string as a wall-clock time in the job's timezone
  return fromZonedTime(localDateTimeString, timezone);
};

/**
 * Convert UTC date to datetime-local input value in job timezone
 */
export const utcToLocalInput = (utcDate: Date | string, timezone: string = MADRID_TIMEZONE): string => {
  const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  const zonedDate = toJobTimezone(date, timezone);
  
  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  return format(zonedDate, "yyyy-MM-dd'T'HH:mm");
};

export const formatMadridDateKey = (date: Date | string): string => {
  const utcDate = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(utcDate, MADRID_TIMEZONE, "yyyy-MM-dd");
};

export const fromMadridDateKey = (dateKey: string, time: string = "00:00:00"): Date =>
  fromZonedTime(`${dateKey}T${time}`, MADRID_TIMEZONE);

export const addMadridCalendarDays = (dateKey: string, amount: number): string => {
  const madridNoon = fromMadridDateKey(dateKey, "12:00:00");
  return formatMadridDateKey(addDays(madridNoon, amount));
};

export type MadridMonthGrid = {
  todayKey: string;
  monthStartKey: string;
  gridStartKey: string;
  gridEndKey: string;
  gridStart: Date;
  gridEnd: Date;
  focusMonth: number;
  focusYear: number;
  dateKeys: string[];
};

export const getMadridMonthGrid = (reference: Date = new Date()): MadridMonthGrid => {
  const todayKey = formatMadridDateKey(reference);
  const monthStartKey = `${formatInTimeZone(reference, MADRID_TIMEZONE, "yyyy-MM")}-01`;
  const monthStart = fromMadridDateKey(monthStartKey, "12:00:00");
  const isoWeekday = Number(formatInTimeZone(monthStart, MADRID_TIMEZONE, "i"));
  const gridStartKey = addMadridCalendarDays(monthStartKey, -(isoWeekday - 1));
  const dateKeys = Array.from({ length: 42 }, (_, index) => addMadridCalendarDays(gridStartKey, index));
  const gridEndKey = dateKeys[dateKeys.length - 1];

  return {
    todayKey,
    monthStartKey,
    gridStartKey,
    gridEndKey,
    gridStart: fromMadridDateKey(gridStartKey),
    gridEnd: fromMadridDateKey(gridEndKey, "23:59:59.999"),
    focusMonth: Number(formatInTimeZone(reference, MADRID_TIMEZONE, "M")) - 1,
    focusYear: Number(formatInTimeZone(reference, MADRID_TIMEZONE, "yyyy")),
    dateKeys,
  };
};
