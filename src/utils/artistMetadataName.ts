/**
 * Mirrors supabase/functions/enrich-artist-metadata/wikidata.ts normalizeArtistName.
 * Keep both in sync: this is the cache key used to look up
 * artist_external_metadata rows, so client and Edge Function must agree.
 */
export function normalizeArtistName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
