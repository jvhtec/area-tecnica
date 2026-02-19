import { addDays, startOfDay } from 'date-fns';
import { fromJobTimezone, toJobTimezone } from '@/utils/timezoneUtils';

export const JOB_CLOSURE_DAYS = 7;

export const getJobClosureStartUTC = (
  endTime?: string | Date | null,
  timezone: string = 'Europe/Madrid'
): Date | null => {
  if (!endTime) return null;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  if (Number.isNaN(end.getTime())) return null;

  const endLocal = toJobTimezone(end, timezone);
  const closureStartLocal = startOfDay(addDays(endLocal, JOB_CLOSURE_DAYS));
  return fromJobTimezone(closureStartLocal, timezone);
};

export const isJobPastClosureWindow = (
  endTime?: string | Date | null,
  timezone: string = 'Europe/Madrid',
  now: Date = new Date()
): boolean => {
  const closureStart = getJobClosureStartUTC(endTime, timezone);
  if (!closureStart) return false;
  return now >= closureStart;
};
