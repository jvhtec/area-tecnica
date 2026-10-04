import { es } from 'date-fns/locale';
import { getAssignableJobDateKeys, type AssignableJob } from '@/components/matrix/assignJobDialogTypes';
import type { AssignmentCoverage } from '@/features/assignments/commands';
import { formatMadridDayKey } from '@/utils/timezoneUtils';

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
