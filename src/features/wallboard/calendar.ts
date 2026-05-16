import type { CalendarFeed, JobsOverviewJob } from './types';
import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
  getMadridMonthGrid,
  MADRID_TIMEZONE,
} from '@/utils/timezoneUtils';

export const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const SPANISH_DAY_NAMES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'] as const;

export type CalendarCell = {
  date: Date;
  isoKey: string;
  inMonth: boolean;
  isToday: boolean;
  jobs: JobsOverviewJob[];
  hasHighlight: boolean;
  highlightJobIds: Set<string>;
};

export function formatDateKey(date: Date): string {
  return formatMadridDateKey(date);
}

export function buildCalendarFromJobsList(jobs: JobsOverviewJob[]): CalendarFeed {
  const now = new Date();
  const grid = getMadridMonthGrid(now);

  const calendarStartISO = grid.gridStart.toISOString();
  const calendarEndISO = grid.gridEnd.toISOString();
  const calendarStartMs = grid.gridStart.getTime();
  const calendarEndMs = grid.gridEnd.getTime();

  const jobsByDate: Record<string, JobsOverviewJob[]> = {};
  const jobDateLookup: Record<string, string> = {};
  const sorted = [...jobs].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  sorted.forEach((job) => {
    const startTs = new Date(job.start_time).getTime();
    const endTs = new Date(job.end_time).getTime();
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) return;

    const spanStart = Math.max(startTs, calendarStartMs);
    const spanEnd = Math.min(endTs, calendarEndMs);
    if (spanEnd < spanStart) return;

    const primaryKey = formatMadridDateKey(new Date(job.start_time));
    jobDateLookup[job.id] = primaryKey;

    let dayKey = formatMadridDateKey(new Date(spanStart));
    const lastDayKey = formatMadridDateKey(new Date(spanEnd));

    while (dayKey <= lastDayKey) {
      const bucket = jobsByDate[dayKey] ?? (jobsByDate[dayKey] = []);
      bucket.push(job);
      const nextDayKey = addMadridCalendarDays(dayKey, 1);
      if (nextDayKey === dayKey) break;
      dayKey = nextDayKey;
    }
  });

  return {
    jobs: sorted,
    jobsByDate,
    jobDateLookup,
    range: { start: calendarStartISO, end: calendarEndISO },
    focusMonth: grid.focusMonth,
    focusYear: grid.focusYear,
  };
}

export function buildCalendarModel(
  data: CalendarFeed | null,
  highlightIds?: Set<string>,
  currentMonthOnly: boolean = true
): { dayNames: readonly string[]; monthLabel: string; cells: CalendarCell[] } {
  const today = new Date();
  const grid = getMadridMonthGrid(today);
  const highlightSet = highlightIds ? new Set(highlightIds) : new Set<string>();

  const dayCount = 42;
  const todayKey = grid.todayKey;

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
  const monthLabel = monthFormatter.format(fromMadridDateKey(grid.monthStartKey, '12:00:00'));

  const focusMonthKey = grid.monthStartKey.slice(0, 7);

  const cells: CalendarCell[] = Array.from({ length: dayCount }, (_, idx) => {
    const isoKey = grid.dateKeys[idx];
    const date = fromMadridDateKey(isoKey, '12:00:00');
    const jobs = jobsByKey[isoKey] ?? [];
    const highlightBucket = highlightByKey.get(isoKey) ?? new Set<string>();
    return {
      date,
      isoKey,
      inMonth: isoKey.startsWith(focusMonthKey),
      isToday: isoKey === todayKey,
      jobs,
      hasHighlight: highlightBucket.size > 0,
      highlightJobIds: new Set<string>(highlightBucket),
    };
  });

  return { dayNames: DAY_LABELS, monthLabel, cells };
}
