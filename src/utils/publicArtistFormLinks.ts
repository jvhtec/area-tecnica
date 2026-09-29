import { supabase } from "@/lib/supabase";

interface ArtistPublicLinkInput {
  id: string;
  form_language?: string | null;
}

interface ArtistFormRow {
  artist_id: string;
  token: string | null;
}

const normalizeLanguage = (value?: string | null): "es" | "en" => (value === "en" ? "en" : "es");

/**
 * Return links only for active tokens that were already issued by an explicit
 * send action. Report generation must never mint public bearer credentials.
 */
export const getActivePublicArtistFormLinks = async (
  artists: ArtistPublicLinkInput[],
): Promise<Record<string, string>> => {
  const byId = new Map<string, ArtistPublicLinkInput>();
  artists.forEach((artist) => {
    if (artist.id) {
      byId.set(artist.id, artist);
    }
  });

  const artistIds = Array.from(byId.keys());
  if (artistIds.length === 0) return {};

  const nowIso = new Date().toISOString();
  const existingLinkTokens = new Map<string, string>();

  const { data: existingForms, error: existingError } = await supabase
    .from("festival_artist_forms")
    .select("artist_id, token, expires_at")
    .in("artist_id", artistIds)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false });

  if (existingError) throw existingError;

  (existingForms || []).forEach((row) => {
    const typedRow = row as unknown as ArtistFormRow;
    if (typedRow.artist_id && typedRow.token && !existingLinkTokens.has(typedRow.artist_id)) {
      existingLinkTokens.set(typedRow.artist_id, typedRow.token);
    }
  });

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://sector-pro.work";

  const linksByArtistId: Record<string, string> = {};

  artistIds.forEach((artistId) => {
    const token = existingLinkTokens.get(artistId);
    if (!token) return;

    const language = normalizeLanguage(byId.get(artistId)?.form_language);
    linksByArtistId[artistId] = `${origin}/festival/artist-form/${token}?lang=${language}`;
  });

  return linksByArtistId;
};

