import type { ProgramDay } from "@/types/hoja-de-ruta";
import { formatMadridDateKey, fromMadridDateKey } from "@/utils/timezoneUtils";

/**
 * Effective day window for a job derived from its hoja de ruta programa.
 *
 * Job `start_time`/`end_time` are entered as preliminary values at creation
 * and routinely never updated; production enters the real schedule in the
 * hoja de ruta "programa" section. When a programa exists for the viewed day,
 * its first and last row are the authoritative day window.
 */
export interface ProgramaWindow {
  start: Date;
  end: Date;
  /** Raw "HH:mm" wall-clock labels straight from the programa rows. */
  startLabel: string;
  endLabel: string;
  rowCount: number;
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/**
 * Derives the programa window for one calendar day (Madrid `yyyy-MM-dd` key).
 *
 * Day matching follows the push programa feed's semantics
 * (`supabase/functions/push/programaFeedUtils.ts`): a day with `date` set only
 * applies on that date; undated days (common on multi-day jobs) apply to every
 * day the job runs, so they are included for any requested key. Row times are
 * Madrid wall-clock; a row entered as e.g. "01:00" for an after-midnight cue
 * is taken literally on the same day — the schema has no overnight marker.
 */
export function deriveProgramaWindow(
  days: ProgramDay[] | null | undefined,
  dateKey: string,
): ProgramaWindow | null {
  if (!Array.isArray(days) || days.length === 0) return null;

  const times: string[] = [];
  for (const day of days) {
    if (day?.date && day.date !== dateKey) continue;
    for (const row of day?.rows ?? []) {
      const time = typeof row?.time === "string" ? row.time.trim() : "";
      if (TIME_RE.test(time)) times.push(time.length === 4 ? `0${time}` : time);
    }
  }
  if (times.length === 0) return null;

  times.sort();
  const startLabel = times[0];
  const endLabel = times[times.length - 1];

  return {
    start: fromMadridDateKey(dateKey, `${startLabel}:00`),
    end: fromMadridDateKey(dateKey, `${endLabel}:00`),
    startLabel,
    endLabel,
    rowCount: times.length,
  };
}

/** Madrid date key for the agenda's selected date. */
export const programaDateKey = (date: Date): string => formatMadridDateKey(date);
