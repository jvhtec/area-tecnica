
import { format, formatInTimeZone, toDate } from 'date-fns-tz';
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
  // Convert the date to UTC while preserving the local time
  const localDate = toDate(dateObj, { timeZone: timezone });
  return new Date(
    Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours(),
      localDate.getMinutes(),
      localDate.getSeconds(),
      localDate.getMilliseconds()
    )
  );
}

export function convertToLocalTime(date: Date | string, timezone: string = getUserTimezone()): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toDate(dateObj, { timeZone: timezone });
}

export function createLocalDate(isoString?: string): Date {
  if (!isoString) return new Date();
  return convertToLocalTime(parseISO(isoString));
}

