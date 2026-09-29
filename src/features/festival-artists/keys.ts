import { queryKeys } from "@/lib/react-query";

/**
 * Query keys of the artists sub-domain. They reuse the app-wide scope names on purpose:
 * the shell, the offline sync and the realtime subscriptions invalidate these prefixes.
 */
export const festivalArtistKeys = {
  /** Prefix matching both the per-date and the all-dates artist caches. */
  artists: (jobId: string | undefined) => queryKeys.scope("festival-artists", jobId),
  artist: (artistId: string) => ["festival-artist", artistId] as const,
  stageNames: (jobId: string | undefined) => queryKeys.scope("festival-stages", jobId),
  logo: (jobId: string | undefined) => queryKeys.scope("festival-logo", jobId),
  gearSetups: (jobId: string | undefined) => ["festival-artist-gear-setups", jobId] as const,
  copyFestivals: (currentJobId: string) => ["festival-copy-source-festivals", currentJobId] as const,
  copyDates: (festivalId: string) => ["festival-copy-source-dates", festivalId] as const,
  copyDayArtists: (festivalId: string, date: string) => ["festival-copy-source-artists", festivalId, date] as const,
  copySearch: (currentJobId: string, term: string) => ["copy-artists-search", currentJobId, term] as const,
  scheduleArtists: (jobId: string | undefined) => ["festival-schedule-artists", jobId] as const,
};
