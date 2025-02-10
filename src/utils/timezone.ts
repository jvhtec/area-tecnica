
import { format, formatInTimeZone, toDate, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';

export const DEFAULT_TIMEZONE = 'Europe/Madrid';

export function getUserTimezone(): string {
  // For now return default, in future could get from user profile
  return DEFAULT_TIMEZONE;
}

export function formatToLocalTime(date: Date | string | null, formatStr: string = 'yyyy-MM-dd HH:mm'): string {
  if (!date) return '';
  const timezone = getUserTimezone();
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, formatStr);
}

export function convertToUTC(date: Date | string, timezone: string = getUserTimezone()): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return fromZonedTime(dateObj, timezone);
}

export function convertToLocalTime(date: Date | string, timezone: string = getUserTimezone()): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, timezone);
}

export function createLocalDate(isoString?: string): Date {
  if (!isoString) return toZonedTime(new Date(), getUserTimezone());
  return toZonedTime(parseISO(isoString), getUserTimezone());
}

