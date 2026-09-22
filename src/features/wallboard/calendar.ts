import type { CalendarFeed, JobsOverviewJob } from './types';
import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
  MADRID_TIMEZONE,
} from '@/utils/timezoneUtils';

export const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const DEFAULT_DAY_COUNT = 28;
const MAX_DAY_COUNT = 42;

export type CalendarCell = {
  date: Date;
  isoKey: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  jobs: JobsOverviewJob[];
  hasHighlight: boolean;
  highlightJobIds: Set<string>;
};

/** Monday of the Madrid week containing `date`. */
function madridMondayKey(date: Date): string {
  const key = formatMadridDateKey(date);
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  return addMadridCalendarDays(key, -((weekday + 6) % 7));
}

function dayCountBetween(startKey: string, endKey: string): number {
  let count = 1;
  let cursor = startKey;
  while (cursor < endKey && count < MAX_DAY_COUNT) {
    cursor = addMadridCalendarDays(cursor, 1);
    count += 1;
  }
  return count;
}

/**
 * Builds the calendar cells from the server-owned Madrid range. The server
 * decides the window (currently four weeks from this Monday); without a feed
 * the display falls back to the same rule on the device clock.
 */
export function buildCalendarModel(
  data: CalendarFeed | null,
  highlightIds?: Set<string>,
): { dayNames: readonly string[]; monthLabel: string; cells: CalendarCell[] } {
  const today = new Date();
  const todayKey = formatMadridDateKey(today);
  const highlightSet = highlightIds ? new Set(highlightIds) : new Set<string>();

  const gridStartKey = data ? formatMadridDateKey(new Date(data.range.start)) : madridMondayKey(today);
  const rawCount = data
    ? dayCountBetween(gridStartKey, formatMadridDateKey(new Date(data.range.end)))
    : DEFAULT_DAY_COUNT;
  const dayCount = Math.min(MAX_DAY_COUNT, Math.max(7, Math.ceil(rawCount / 7) * 7));
  const dateKeys = Array.from({ length: dayCount }, (_, index) => addMadridCalendarDays(gridStartKey, index));

  const [todayYear, todayMonth] = todayKey.split('-').map(Number);
  const focusYear = data?.focusYear ?? todayYear;
  const focusMonth = data?.focusMonth ?? todayMonth - 1;
  const focusMonthKey = `${focusYear}-${String(focusMonth + 1).padStart(2, '0')}`;

  const jobsByKey = data?.jobsByDate ?? {};
  const highlightByKey = new Map<string, Set<string>>();
  if (data) {
    highlightSet.forEach((jobId) => {
      const key = data.jobDateLookup[jobId];
      if (!key) return;
      const bucket = highlightByKey.get(key) ?? new Set<string>();
      bucket.add(jobId);
      highlightByKey.set(key, bucket);
    });
  }

  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: MADRID_TIMEZONE });
  const monthLabel = monthFormatter.format(fromMadridDateKey(`${focusMonthKey}-01`, '12:00:00'));

  const cells: CalendarCell[] = dateKeys.map((isoKey, index) => {
    const highlightBucket = highlightByKey.get(isoKey) ?? new Set<string>();
    return {
      date: fromMadridDateKey(isoKey, '12:00:00'),
      isoKey,
      inMonth: isoKey.startsWith(focusMonthKey),
      isToday: isoKey === todayKey,
      isWeekend: index % 7 >= 5,
      jobs: jobsByKey[isoKey] ?? [],
      hasHighlight: highlightBucket.size > 0,
      highlightJobIds: new Set<string>(highlightBucket),
    };
  });

  return { dayNames: DAY_LABELS, monthLabel, cells };
}
