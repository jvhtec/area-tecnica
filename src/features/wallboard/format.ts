import { MADRID_TIMEZONE, addMadridCalendarDays, formatMadridDateKey } from '@/utils/timezoneUtils';

/**
 * Every date and time on the wallboard is shown in Madrid time with Spanish
 * formatting, whatever the locale or clock settings of the TV running it.
 */
const timeFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const weekdayDayFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
});

const weekdayLongFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
});

const dayMonthFormatter = new Intl.DateTimeFormat('es-ES', {
  timeZone: MADRID_TIMEZONE,
  day: 'numeric',
  month: 'short',
});

const stripDot = (value: string) => value.replace(/\./g, '');

const toDate = (value: Date | string): Date | null => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `09:00` in Madrid time. */
export function formatMadridTime(value: Date | string): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : '—';
}

/** `hoy`, `mañana` or `jue 24`, relative to `now` in Madrid. */
export function formatRelativeDay(value: Date | string, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return '—';
  const key = formatMadridDateKey(date);
  const todayKey = formatMadridDateKey(now);
  if (key === todayKey) return 'hoy';
  if (key === addMadridCalendarDays(todayKey, 1)) return 'mañana';
  return stripDot(weekdayDayFormatter.format(date)).replace(',', '');
}

/** `hoy · 09:00–23:00` for one-day jobs, `mié 23 → vie 25` for multi-day ones. */
export function formatJobWhen(start: string, end: string, now: Date = new Date()): string {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return '—';
  if (formatMadridDateKey(startDate) === formatMadridDateKey(endDate)) {
    return `${formatRelativeDay(startDate, now)} · ${formatMadridTime(startDate)}–${formatMadridTime(endDate)}`;
  }
  return `${formatRelativeDay(startDate, now)} → ${formatRelativeDay(endDate, now)}`;
}

/** Days until a job starts: `hoy`, `mañana`, `en 3 días`, or `en curso` once started. */
export function formatStartsIn(start: string, now: Date = new Date()): string {
  const startDate = toDate(start);
  if (!startDate) return '—';
  const todayKey = formatMadridDateKey(now);
  const startKey = formatMadridDateKey(startDate);
  if (startKey < todayKey) return 'en curso';
  if (startKey === todayKey) return 'hoy';
  if (startKey === addMadridCalendarDays(todayKey, 1)) return 'mañana';
  let days = 1;
  let cursor = addMadridCalendarDays(todayKey, 1);
  while (cursor < startKey && days < 60) {
    cursor = addMadridCalendarDays(cursor, 1);
    days += 1;
  }
  return `en ${days} días`;
}

/** Day header for grouped lists: `{ relative: 'Hoy', label: 'martes 22' }`. */
export function formatDayHeading(dateKey: string, now: Date = new Date()): { relative: string | null; label: string } {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const todayKey = formatMadridDateKey(now);
  const relative = dateKey === todayKey ? 'Hoy' : dateKey === addMadridCalendarDays(todayKey, 1) ? 'Mañana' : null;
  return { relative, label: Number.isNaN(date.getTime()) ? dateKey : weekdayLongFormatter.format(date) };
}

/** `22 sep – 18 oct` for a date-key range. */
export function formatDateKeyRange(startKey: string, endKey: string): string {
  const start = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${stripDot(dayMonthFormatter.format(start))} – ${stripDot(dayMonthFormatter.format(end))}`;
}

/** Short month (`oct`) for a date key, used to mark the first day of a new month. */
export function formatShortMonth(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ''
    : stripDot(new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', month: 'short' }).format(date));
}

/** `hace 12 s`, `hace 3 min`. */
export function formatAgo(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}
