
interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  soundcheck_start?: string;
  line_check_start?: string;
  isaftermidnight?: boolean;
}

export type ArtistSortField = 'chronological' | 'show_start' | 'soundcheck_start' | 'line_check_start';

export const ARTIST_SORT_FIELD_LABELS: Record<ArtistSortField, string> = {
  chronological: 'Cronológico',
  show_start: 'Hora del show',
  soundcheck_start: 'Soundcheck',
  line_check_start: 'Line check',
};

export const sortArtistsChronologically = (artists: Artist[]) => {
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
    const aTime = a.show_start || '';
    const bTime = b.show_start || '';

    // Use isaftermidnight field if available, otherwise fall back to time-based logic
    let adjustedATime = aTime;
    let adjustedBTime = bTime;
    
    if (a.isaftermidnight !== undefined && b.isaftermidnight !== undefined) {
      // Use the calculated isaftermidnight field for more accurate sorting
      if (a.isaftermidnight) {
        const aHour = parseInt(aTime.split(':')[0], 10);
        adjustedATime = `${aHour + 24}${aTime.substring(aTime.indexOf(':'))}`;
      }
      if (b.isaftermidnight) {
        const bHour = parseInt(bTime.split(':')[0], 10);
        adjustedBTime = `${bHour + 24}${bTime.substring(bTime.indexOf(':'))}`;
      }
    } else {
      // Fallback to hardcoded logic for backward compatibility
      const aHour = aTime ? parseInt(aTime.split(':')[0], 10) : 0;
      const bHour = bTime ? parseInt(bTime.split(':')[0], 10) : 0;
      
      // If show starts between 00:00-06:59, treat it as next day for sorting
      adjustedATime = aHour >= 0 && aHour < 7 ? `${aHour + 24}${aTime.substring(aTime.indexOf(':'))}` : aTime;
      adjustedBTime = bHour >= 0 && bHour < 7 ? `${bHour + 24}${bTime.substring(bTime.indexOf(':'))}` : bTime;
    }
    
    if (adjustedATime < adjustedBTime) return -1;
    if (adjustedATime > adjustedBTime) return 1;

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
  return `${adjustedHour}${time.substring(time.indexOf(':'))}`;
};

export const sortArtistsByField = (artists: Artist[], field: Exclude<ArtistSortField, 'chronological'>) => {
  return [...artists].sort((a, b) => {
    const aTime = normalizeTimeForSort(a[field], a.isaftermidnight);
    const bTime = normalizeTimeForSort(b[field], b.isaftermidnight);

    // Artists missing the selected time field sort to the end
    if (aTime === null && bTime === null) return (a.name || '').localeCompare(b.name || '');
    if (aTime === null) return 1;
    if (bTime === null) return -1;

    if (aTime < bTime) return -1;
    if (aTime > bTime) return 1;

    return (a.name || '').localeCompare(b.name || '');
  });
};
