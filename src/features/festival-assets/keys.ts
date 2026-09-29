/** Query keys of the festival assets sub-domain (logos and artist files). */
export const festivalAssetKeys = {
  logo: (jobId: string) => ["festival-logo-manager", jobId] as const,
  artistFiles: (artistId: string) => ["festival-artist-files", artistId] as const,
};
