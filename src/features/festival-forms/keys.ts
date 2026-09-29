/** Query keys of the public artist form sub-domain. */
export const festivalFormKeys = {
  /** Every artist's active link for one festival (the "links" overview dialog). */
  links: (jobId: string | undefined) => ["festival-artist-form-links", jobId] as const,
  /** One artist's language and active link (the "send form" dialog). */
  artist: (artistId: string | undefined) => ["festival-artist-form", artistId] as const,
  qr: (link: string) => ["festival-artist-form-qr", link] as const,
};
