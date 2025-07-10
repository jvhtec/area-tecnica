
interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
  isaftermidnight?: boolean;
}

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
