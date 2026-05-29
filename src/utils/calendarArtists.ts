import { format } from "date-fns";

export interface CalendarArtist {
  id?: string | null;
  name?: string | null;
  date?: string | null;
  show_start?: string | null;
  stage?: number | null;
  isaftermidnight?: boolean | null;
}

interface CalendarJobWithArtists {
  title?: string | null;
  job_name?: string | null;
  festival_artists?: CalendarArtist[] | null;
}

const normalizeArtistDate = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  return trimmed.split("T")[0].slice(0, 10);
};

const getArtistSortMinutes = (artist: CalendarArtist) => {
  const match = artist.show_start?.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.POSITIVE_INFINITY;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }

  return hours * 60 + minutes + (artist.isaftermidnight ? 24 * 60 : 0);
};

export const getCalendarArtistsForDate = (job: CalendarJobWithArtists, date: Date): CalendarArtist[] => {
  const targetDate = format(date, "yyyy-MM-dd");
  const artists = Array.isArray(job.festival_artists) ? job.festival_artists : [];

  return artists
    .filter((artist) => normalizeArtistDate(artist.date) === targetDate && Boolean(artist.name?.trim()))
    .slice()
    .sort((a, b) => {
      const timeDiff = getArtistSortMinutes(a) - getArtistSortMinutes(b);
      if (timeDiff !== 0) return timeDiff;

      const stageDiff = (a.stage ?? Number.MAX_SAFE_INTEGER) - (b.stage ?? Number.MAX_SAFE_INTEGER);
      if (stageDiff !== 0) return stageDiff;

      return (a.name || "").localeCompare(b.name || "");
    });
};

export const getCalendarArtistNamesForDate = (job: CalendarJobWithArtists, date: Date): string[] => {
  const seen = new Set<string>();

  return getCalendarArtistsForDate(job, date).reduce<string[]>((names, artist) => {
    const name = artist.name?.trim();
    if (!name) return names;

    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return names;

    seen.add(key);
    names.push(name);
    return names;
  }, []);
};

export const formatCalendarArtistSummary = (artistNames: string[], maxVisible = 2) => {
  if (artistNames.length === 0) return "";
  if (artistNames.length <= maxVisible) return artistNames.join(", ");

  return `${artistNames.slice(0, maxVisible).join(", ")} +${artistNames.length - maxVisible}`;
};

export const getCalendarJobDisplayTitle = (
  job: CalendarJobWithArtists,
  date: Date,
  maxVisibleArtists = 2,
) => {
  const title = (job.title || job.job_name || "Untitled Job").trim();
  const artistSummary = formatCalendarArtistSummary(
    getCalendarArtistNamesForDate(job, date),
    maxVisibleArtists,
  );

  return artistSummary ? `${title} - ${artistSummary}` : title;
};
