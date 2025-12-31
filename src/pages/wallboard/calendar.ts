import type { CalendarFeed, JobsOverviewJob } from './types';

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
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildCalendarFromJobsList(jobs: JobsOverviewJob[]): CalendarFeed {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (startOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(startOfMonth.getTime() - offset * MS_PER_DAY);
  const gridEnd = new Date(gridStart.getTime() + 42 * MS_PER_DAY - 1);

  const calendarStartISO = gridStart.toISOString();
  const calendarEndISO = gridEnd.toISOString();
  const calendarStartMs = gridStart.getTime();
  const calendarEndMs = gridEnd.getTime();

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

    const primaryKey = formatDateKey(new Date(job.start_time));
    jobDateLookup[job.id] = primaryKey;

    let day = new Date(spanStart);
    day.setHours(0, 0, 0, 0);
    const lastDay = new Date(spanEnd);
    lastDay.setHours(0, 0, 0, 0);

    while (day.getTime() <= lastDay.getTime()) {
      const key = formatDateKey(day);
      const bucket = jobsByDate[key] ?? (jobsByDate[key] = []);
      bucket.push(job);
      day = new Date(day.getTime() + MS_PER_DAY);
    }
  });

  return {
    jobs: sorted,
    jobsByDate,
    jobDateLookup,
    range: { start: calendarStartISO, end: calendarEndISO },
    focusMonth: now.getMonth(),
    focusYear: now.getFullYear(),
  };
}

export function buildCalendarModel(
  data: CalendarFeed | null,
  highlightIds?: Set<string>,
  currentMonthOnly: boolean = true
): { dayNames: readonly string[]; monthLabel: string; cells: CalendarCell[] } {
  const today = new Date();
  const highlightSet = highlightIds ? new Set(highlightIds) : new Set<string>();

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (startOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(startOfMonth.getTime() - offset * MS_PER_DAY);
  const gridEnd = new Date(gridStart.getTime() + (42 - 1) * MS_PER_DAY);

  const dayCount = 42;
  const todayKey = formatDateKey(today);

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

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const monthLabel = monthFormatter.format(startOfMonth);

  const focusMonth = today.getMonth();
  const focusYear = today.getFullYear();

  const cells: CalendarCell[] = Array.from({ length: dayCount }, (_, idx) => {
    const date = new Date(gridStart.getTime() + idx * MS_PER_DAY);
    const isoKey = formatDateKey(date);
    const jobs = jobsByKey[isoKey] ?? [];
    const highlightBucket = highlightByKey.get(isoKey) ?? new Set<string>();
    return {
      date,
      isoKey,
      inMonth: date.getMonth() === focusMonth && date.getFullYear() === focusYear,
      isToday: isoKey === todayKey,
      jobs,
      hasHighlight: highlightBucket.size > 0,
      highlightJobIds: new Set<string>(highlightBucket),
    };
  });

  return { dayNames: DAY_LABELS, monthLabel, cells };
}
