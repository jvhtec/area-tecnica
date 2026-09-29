/** Query keys of the festival assets sub-domain (logos and artist files). */
export const festivalAssetKeys = {
  logo: (jobId: string) => ["festival-logo-manager", jobId] as const,
  /** Prefix of the batched logo lookups behind the festival list. */
  listLogos: () => ["festival-list-logos"] as const,
  artistFiles: (artistId: string) => ["festival-artist-files", artistId] as const,
};
