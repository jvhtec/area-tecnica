
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

/** Matches a bare calendar day, as distinct from a full ISO timestamp. */
const MADRID_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Madrid calendar day for an instant — or the identity, for a value that is
 * already a Madrid day key.
 *
 * The distinction matters because the two kinds of string need opposite
 * treatment. A timestamp ("2026-03-12T23:30:00Z") is an instant and has to be
 * converted, which is what the previous unconditional `parseISO` did. A bare
 * "2026-03-12" is already a Madrid day, but `parseISO` reads it as a *local*
 * midnight, and east of Madrid that instant still falls on the previous Madrid
 * day — so the key came back shifted by one (in Asia/Tokyo, "2026-03-12"
 * returned "2026-03-11", and `isMadridWeekend` denied that Saturday was a
 * weekend). Passing day keys straight through fixes every caller that hands
 * this function a key rather than only the two that were noticed.
 */
export const formatMadridDateKey = (date: Date | string): string => {
  if (typeof date === "string") {
    if (MADRID_DATE_KEY_PATTERN.test(date)) return date;
    return formatInTimeZone(parseISO(date), MADRID_TIMEZONE, "yyyy-MM-dd");
  }
  return formatInTimeZone(date, MADRID_TIMEZONE, "yyyy-MM-dd");
};

export const fromMadridDateKey = (dateKey: string, time: string = "00:00:00"): Date =>
  fromZonedTime(`${dateKey}T${time}`, MADRID_TIMEZONE);

/**
 * Turns a Madrid calendar-day key into the local-midnight Date that calendar
 * widgets (react-day-picker) render and that `format(date, "yyyy-MM-dd")`
 * round-trips back to the same key. This is a calendar day, not an instant —
 * use `fromMadridDateKey` when you need the actual UTC moment.
 */
export const madridDateKeyToCalendarDate = (dateKey: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  // Date rolls impossible components over instead of failing ("2026-02-30"
  // becomes March 2), so reject anything it had to normalise.
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

/** Madrid-local equivalents of date-fns `isToday` / `isWeekend`. */
export const isMadridToday = (date: Date | string): boolean =>
  formatMadridDateKey(date) === formatMadridDateKey(new Date());

export const isMadridWeekend = (date: Date | string): boolean => {
  // Read the weekday off the Madrid calendar day rather than the browser's.
  const day = new Date(`${formatMadridDateKey(date)}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export const addMadridCalendarDays = (dateKey: string, amount: number): string => {
  const madridNoon = fromMadridDateKey(dateKey, "12:00:00");
  return formatMadridDateKey(addDays(madridNoon, amount));
};

export type CalendarPeriodDateKeys = {
  monthStart: string;
  monthEnd: string;
  yearStart: string;
  yearEnd: string;
  previousYearStart: string;
  previousYearEnd: string;
};

/** Returns SQL date-key boundaries without serializing local midnight through UTC. */
export const getCalendarPeriodDateKeys = (
  reference: Date = new Date(),
  timezone: string = MADRID_TIMEZONE,
): CalendarPeriodDateKeys => {
  const year = Number(formatInTimeZone(reference, timezone, "yyyy"));
  const month = Number(formatInTimeZone(reference, timezone, "M"));
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthEndDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    monthStart: `${monthKey}-01`,
    monthEnd: `${monthKey}-${String(monthEndDay).padStart(2, "0")}`,
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    previousYearStart: `${year - 1}-01-01`,
    previousYearEnd: `${year - 1}-12-31`,
  };
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
