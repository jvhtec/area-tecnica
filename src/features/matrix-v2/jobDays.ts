import { es } from 'date-fns/locale';
import { normalizeDateKey, uniqueSortedDateKeys } from '@/utils/assignmentWorkDates';
import type { AssignmentCoverage } from '@/features/assignments/commands';
import { addMadridCalendarDays, formatMadridDayKey } from '@/utils/timezoneUtils';

type AssignableJobDateType = { date?: string | null; type?: string | null };

/** The part of a job that decides which of its days can hold an assignment. */
export type AssignableJob = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_date_types?: AssignableJobDateType[] | null;
};

const EXCLUDED_ASSIGNABLE_DATE_TYPES = new Set(['off', 'travel']);

/**
 * Every job date that may receive an assignment, including prep/rehearsal typed
 * dates before the main job span while excluding non-work travel/off days.
 */
export const getAssignableJobDateKeys = (job: AssignableJob | null | undefined): string[] => {
  if (!job) return [];

  const keys = new Set<string>();
  const excludedTypedDates = new Set<string>();
  const dateTypes = Array.isArray(job.job_date_types) ? job.job_date_types : [];

  dateTypes.forEach((row) => {
    const key = normalizeDateKey(row?.date);
    if (!key) return;
    const type = String(row?.type || '').toLowerCase();
    if (EXCLUDED_ASSIGNABLE_DATE_TYPES.has(type)) {
      excludedTypedDates.add(key);
      return;
    }
    keys.add(key);
  });

  const startKey = normalizeDateKey(job.start_time);
  if (!startKey) return uniqueSortedDateKeys(keys);
  const endKey = normalizeDateKey(job.end_time) ?? startKey;
  let cursorKey = startKey;

  while (cursorKey <= endKey) {
    if (!excludedTypedDates.has(cursorKey)) keys.add(cursorKey);
    cursorKey = addMadridCalendarDays(cursorKey, 1);
  }

  return uniqueSortedDateKeys(keys);
};

/** Every day of the job that can hold an assignment (prep days included, off/travel days not). */
export const jobDayKeys = (job: AssignableJob | null | undefined): string[] => getAssignableJobDateKeys(job);

export const dayParts = (dateKey: string) => ({
  weekday: formatMadridDayKey(dateKey, 'EEE', { locale: es }).replace('.', ''),
  day: formatMadridDayKey(dateKey, 'd', { locale: es }),
});

/** "jue 15 oct" for one day, "mar 13 – mié 14 oct" for a range. */
export function dayRangeLabel(dateKeys: string[]): string {
  if (dateKeys.length === 0) return '';
  const sorted = [...dateKeys].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const short = (key: string) => formatMadridDayKey(key, 'EEE d', { locale: es }).replace('.', '');
  if (first === last) return `${short(first)} ${formatMadridDayKey(first, 'MMM', { locale: es }).replace('.', '')}`;
  return `${short(first)} – ${short(last)} ${formatMadridDayKey(last, 'MMM', { locale: es }).replace('.', '')}`;
}

export const jobRangeLabel = (job: AssignableJob | null | undefined): string => dayRangeLabel(jobDayKeys(job));

/** Long label for headers: "Jueves 15 de octubre". */
export const longDayLabel = (dateKey: string): string => {
  const label = formatMadridDayKey(dateKey, "EEEE d 'de' MMMM", { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * How a set of selected days is sent to the command: the whole job is "full"
 * (derived by the database, so it follows the job if its dates change), one day
 * is "single", anything else is an explicit list.
 */
export function coverageForDays(
  selected: Iterable<string>,
  jobDays: string[],
): { coverage: AssignmentCoverage; dates?: string[] } {
  const days = [...new Set(selected)].sort();
  const all = [...new Set(jobDays)].sort();
  if (days.length === all.length && days.every((day, index) => day === all[index])) return { coverage: 'full' };
  if (days.length === 1) return { coverage: 'single', dates: days };
  return { coverage: 'multi', dates: days };
}
