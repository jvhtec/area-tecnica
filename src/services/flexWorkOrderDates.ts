import { formatInJobTimezone, MADRID_TIMEZONE } from '@/utils/timezoneUtils';

export function formatFlexWorkOrderDate(
  value: string | null | undefined,
  timezone: string = MADRID_TIMEZONE,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatInJobTimezone(date, 'yyyy-MM-dd', timezone);
}

