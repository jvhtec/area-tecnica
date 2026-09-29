
import { getEffectiveSoundcheckDate } from '@/utils/artistScheduleDates';
import {
  DEFAULT_FESTIVAL_DAY_START_TIME,
  getFestivalDayOffset,
} from '@/features/festival-management/dayStart';

interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck_start?: string;
  soundcheck_date?: string | null;
  line_check_start?: string;
  load_in_time?: string;
  isaftermidnight?: boolean;
}

export type ArtistSortField = 'chronological' | 'load_in_time' | 'show_start' | 'soundcheck_start' | 'line_check_start';

export const ARTIST_SORT_FIELD_LABELS: Record<ArtistSortField, string> = {
  chronological: 'Cronológico',
  load_in_time: 'Load in',
  show_start: 'Hora del show',
  soundcheck_start: 'Soundcheck',
  line_check_start: 'Line check',
};

export const sortArtistsChronologically = (
  artists: Artist[],
  dayStartTime = DEFAULT_FESTIVAL_DAY_START_TIME,
) => {
  const sortableMinutes = (artist: Artist): number =>
    getFestivalDayOffset(artist.show_start, dayStartTime) ?? Number.MAX_SAFE_INTEGER;

  return artists.sort((a, b) => {
    // First sort by date
    if (a.date !== b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }

    // Then sort by stage within the same date
    if (a.stage !== b.stage) {
      return a.stage - b.stage;
    }

    // Finally sort by show time within the same date and stage
    const adjustedATime = sortableMinutes(a);
    const adjustedBTime = sortableMinutes(b);
    if (adjustedATime !== adjustedBTime) return adjustedATime - adjustedBTime;

    // Fallback to artist name
    return (a.name || '').localeCompare(b.name || '');
  });
};

// Normalizes a HH:mm time for comparison, pushing after-midnight shows past 24:00
// so they sort after same-day evening times instead of before them.
const normalizeTimeForSort = (time: string | undefined, isAfterMidnight?: boolean): string | null => {
  if (!time) return null;
  const hour = parseInt(time.split(':')[0], 10);
  if (Number.isNaN(hour)) return null;
  const adjustedHour = isAfterMidnight ? hour + 24 : hour;
  return `${adjustedHour.toString().padStart(2, '0')}${time.substring(time.indexOf(':'))}`;
};

export const sortArtistsByField = (artists: Artist[], field: Exclude<ArtistSortField, 'chronological'>) => {
  return [...artists].sort((a, b) => {
    const aTime = normalizeTimeForSort(a[field], a.isaftermidnight);
    const bTime = normalizeTimeForSort(b[field], b.isaftermidnight);

    // Artists missing the selected time field sort to the end
    if (aTime === null && bTime === null) return (a.name || '').localeCompare(b.name || '');
    if (aTime === null) return 1;
    if (bTime === null) return -1;

    if (field === 'soundcheck_start') {
      const aDate = getEffectiveSoundcheckDate(a);
      const bDate = getEffectiveSoundcheckDate(b);

      if (aDate < bDate) return -1;
      if (aDate > bDate) return 1;
    }

    if (aTime < bTime) return -1;
    if (aTime > bTime) return 1;

    return (a.name || '').localeCompare(b.name || '');
  });
};
