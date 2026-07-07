import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/react-query";
import { normalizeArtistName } from "@/utils/artistMetadataName";

export type ArtistExternalMetadata = {
  normalizedArtistName: string;
  displayArtistName: string;
  wikidataQid: string | null;
  wikipediaLang: string | null;
  wikipediaTitle: string | null;
  wikipediaUrl: string | null;
  description: string | null;
  extract: string | null;
  thumbnailUrl: string | null;
  country: string | null;
  genres: string[];
  foundedOrBirthYear: string | null;
  officialWebsite: string | null;
  matchConfidence: number | null;
  matchStatus: "pending" | "matched" | "needs_review" | "no_match" | "manual";
  source: "wikimedia" | "manual";
  lastCheckedAt: string | null;
};

type MetadataRow = {
  normalized_artist_name: string;
  display_artist_name: string;
  wikidata_qid: string | null;
  wikipedia_lang: string | null;
  wikipedia_title: string | null;
  wikipedia_url: string | null;
  description: string | null;
  extract: string | null;
  thumbnail_url: string | null;
  country: string | null;
  genres: string[];
  founded_or_birth_year: string | null;
  official_website: string | null;
  match_confidence: number | null;
  match_status: string;
  source: string;
  last_checked_at: string | null;
};

function mapRow(row: MetadataRow): ArtistExternalMetadata {
  return {
    normalizedArtistName: row.normalized_artist_name,
    displayArtistName: row.display_artist_name,
    wikidataQid: row.wikidata_qid,
    wikipediaLang: row.wikipedia_lang,
    wikipediaTitle: row.wikipedia_title,
    wikipediaUrl: row.wikipedia_url,
    description: row.description,
    extract: row.extract,
    thumbnailUrl: row.thumbnail_url,
    country: row.country,
    genres: row.genres ?? [],
    foundedOrBirthYear: row.founded_or_birth_year,
    officialWebsite: row.official_website,
    matchConfidence: row.match_confidence,
    matchStatus: row.match_status as ArtistExternalMetadata["matchStatus"],
    source: row.source as ArtistExternalMetadata["source"],
    lastCheckedAt: row.last_checked_at,
  };
}

async function invokeEnrich(body: Record<string, unknown>): Promise<ArtistExternalMetadata> {
  const { data, error } = await supabase.functions.invoke("enrich-artist-metadata", { body });

  if (error) {
    throw new Error(error.message || "No se pudo consultar la metadata del artista.");
  }

  return mapRow(data as MetadataRow);
}

/**
 * Cache-first artist identity lookup: reads artist_external_metadata directly
 * (RLS-scoped, near-instant) and only calls the enrich-artist-metadata Edge
 * Function to resolve/populate the cache when nothing is stored yet.
 */
export function useArtistExternalMetadata(artistName: string, enabled: boolean) {
  const normalizedArtistName = normalizeArtistName(artistName);

  return useQuery({
    queryKey: queryKeys.scope("artist-external-metadata", normalizedArtistName),
    enabled: enabled && Boolean(normalizedArtistName),
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ArtistExternalMetadata> => {
      const { data: cached } = await supabase
        .from("artist_external_metadata")
        .select("*")
        .eq("normalized_artist_name", normalizedArtistName)
        .maybeSingle();

      if (cached) {
        return mapRow(cached as MetadataRow);
      }

      return invokeEnrich({ mode: "lookup", artistName });
    },
  });
}

export function useOverrideArtistExternalMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ artistName, qid }: { artistName: string; qid: string }) =>
      invokeEnrich({ mode: "override", artistName, qid }),
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.scope("artist-external-metadata", result.normalizedArtistName),
        result,
      );
    },
  });
}
