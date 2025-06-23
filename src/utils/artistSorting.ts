
interface Artist {
  id: string;
  name: string;
  stage: number;
  date: string;
  show_start: string;
  show_end: string;
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

    // Handle shows that cross midnight (early morning shows)
    const aHour = aTime ? parseInt(aTime.split(':')[0], 10) : 0;
    const bHour = bTime ? parseInt(bTime.split(':')[0], 10) : 0;

    // If show starts between 00:00-06:59, treat it as next day for sorting
    const adjustedATime = aHour >= 0 && aHour < 7 ? `${aHour + 24}${aTime.substring(aTime.indexOf(':'))}` : aTime;
    const adjustedBTime = bHour >= 0 && bHour < 7 ? `${bHour + 24}${bTime.substring(bTime.indexOf(':'))}` : bTime;
    
    if (adjustedATime < adjustedBTime) return -1;
    if (adjustedATime > adjustedBTime) return 1;

    // Fallback to artist name
    return (a.name || '').localeCompare(b.name || '');
  });
};
