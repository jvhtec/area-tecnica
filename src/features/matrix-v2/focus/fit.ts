import { formatMadridDayKey } from '@/utils/timezoneUtils';
import { es } from 'date-fns/locale';

export type FocusFitKind =
  | 'free'
  /** Some days are taken elsewhere or off, the rest are free. */
  | 'partial-free'
  /** Already on the job for some of its days; the rest are free. */
  | 'partial'
  | 'assigned'
  | 'busy'
  | 'unavailable'
  | 'declined'
  | 'fridge';

export interface FocusFit {
  kind: FocusFitKind;
  /** Job days with nothing in the way. */
  freeDays: string[];
  totalDays: number;
  /** What the technician column shows: "Libre 2/2", "Ocupado mié", "No disp.", "Rechazó", "Nevera". */
  label: string;
  /** Lower sorts first. */
  rank: number;
  /** A click on the name has days to assign. */
  assignable: boolean;
}

export interface FitInput {
  jobId: string;
  /** The job's days that are on the grid. */
  jobDayKeys: string[];
  assignmentOn: (dateKey: string) => { job_id?: string | null } | undefined;
  isUnavailable: (dateKey: string) => boolean;
  declined: boolean;
  fridge: boolean;
}

const RANK: Record<FocusFitKind, number> = {
  free: 0,
  'partial-free': 1,
  partial: 2,
  assigned: 3,
  busy: 4,
  unavailable: 5,
  declined: 6,
  fridge: 7,
};

const weekday = (dateKey: string) => formatMadridDayKey(dateKey, 'EEE', { locale: es }).replace('.', '');

/** How well a technician fits a job over the job's days, from what the grid already knows. */
export function computeFocusFit({ jobId, jobDayKeys, assignmentOn, isUnavailable, declined, fridge }: FitInput): FocusFit {
  const total = jobDayKeys.length;
  const freeDays: string[] = [];
  const busyDays: string[] = [];
  let mine = 0;
  let off = 0;
  for (const dateKey of jobDayKeys) {
    const assignment = assignmentOn(dateKey);
    if (assignment) {
      if (assignment.job_id === jobId) mine += 1;
      else busyDays.push(dateKey);
    } else if (isUnavailable(dateKey)) {
      off += 1;
    } else {
      freeDays.push(dateKey);
    }
  }

  const result = (kind: FocusFitKind, label: string, assignable: boolean): FocusFit => ({
    kind, freeDays, totalDays: total, label, rank: RANK[kind], assignable,
  });

  if (fridge) return result('fridge', 'Nevera', false);
  if (declined) return result('declined', 'Rechazó', false);
  if (total > 0 && mine === total) return result('assigned', 'Asignado', false);
  if (mine > 0) return result(freeDays.length > 0 ? 'partial' : 'assigned', `Asignado ${mine}/${total}`, freeDays.length > 0);
  if (freeDays.length === total && total > 0) return result('free', `Libre ${total}/${total}`, true);
  if (freeDays.length > 0) return result('partial-free', `Libre ${freeDays.length}/${total}`, true);
  if (busyDays.length > 0) return result('busy', `Ocupado ${weekday(busyDays[0])}`, false);
  if (off > 0) return result('unavailable', 'No disp.', false);
  return result('busy', 'Sin días', false);
}

/** Technician ids best-fit first; ties keep their incoming order, so the list is stable. */
export function sortIdsByFit(ids: string[], fits: Map<string, FocusFit>): string[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return [...ids].sort((a, b) =>
    (fits.get(a)?.rank ?? RANK.busy) - (fits.get(b)?.rank ?? RANK.busy)
    || (position.get(a) ?? 0) - (position.get(b) ?? 0));
}
