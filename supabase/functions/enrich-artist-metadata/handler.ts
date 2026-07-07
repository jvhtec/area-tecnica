import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { HttpError, jsonResponse, readJsonBody } from "../_shared/http.ts";
import { requireAuthenticatedRole } from "../_shared/auth.ts";
import {
  fetchEntityLabels,
  fetchWikidataEntities,
  fetchWikipediaSummary,
  searchWikidataCandidates,
} from "./wikimediaClient.ts";
import {
  commonsImageUrl,
  getClaimEntityId,
  getClaimEntityIds,
  getClaimStringValue,
  getClaimTimeYear,
  getEntityDescription,
  getWikipediaSitelink,
  hasClaim,
  normalizeArtistName,
  rankCandidates,
  resolveMatchStatus,
  type WikidataEntity,
} from "./wikidata.ts";

export const ALLOWED_ROLES = ["admin", "management", "logistics"];

// Riders don't disappear and bands don't rename themselves often; a month-old
// cache entry is still useful, so re-resolving is opportunistic, not routine.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 5;
const MAX_SEARCH_RESULTS = 5;

type EnrichRequestBody = {
  mode?: "lookup" | "search" | "override";
  artistName?: string;
  qid?: string;
  forceRefresh?: boolean;
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
  last_checked_at: string;
};

type EntityDetails = {
  wikipediaLang: string | null;
  wikipediaTitle: string | null;
  wikipediaUrl: string | null;
  description: string | null;
  extract: string | null;
  thumbnailUrl: string | null;
  country: string | null;
  genres: string[];
  officialWebsite: string | null;
  foundedOrBirthYear: string | null;
};

const EMPTY_DETAILS: EntityDetails = {
  wikipediaLang: null,
  wikipediaTitle: null,
  wikipediaUrl: null,
  description: null,
  extract: null,
  thumbnailUrl: null,
  country: null,
  genres: [],
  officialWebsite: null,
  foundedOrBirthYear: null,
};

function mapRowToResponse(row: MetadataRow) {
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
    matchStatus: row.match_status,
    source: row.source,
    lastCheckedAt: row.last_checked_at,
  };
}

async function resolveEntityDetails(entity: WikidataEntity): Promise<EntityDetails> {
  const sitelink = getWikipediaSitelink(entity);
  const summary = sitelink ? await fetchWikipediaSummary(sitelink.lang, sitelink.title) : null;

  const genreIds = getClaimEntityIds(entity, "P136").slice(0, 5);
  const countryId = getClaimEntityId(entity, "P495") ?? getClaimEntityId(entity, "P27");
  const labels = await fetchEntityLabels(countryId ? [...genreIds, countryId] : genreIds);

  const imageFileName = getClaimStringValue(entity, "P18");

  return {
    wikipediaLang: sitelink?.lang ?? null,
    wikipediaTitle: sitelink?.title ?? null,
    wikipediaUrl:
      summary?.canonicalUrl ??
      (sitelink ? `https://${sitelink.lang}.wikipedia.org/wiki/${encodeURIComponent(sitelink.title)}` : null),
    description: summary?.description ?? getEntityDescription(entity, ["es", "en"]) ?? null,
    extract: summary?.extract ?? null,
    thumbnailUrl: summary?.thumbnailUrl ?? (imageFileName ? commonsImageUrl(imageFileName) : null),
    country: countryId ? labels[countryId] ?? null : null,
    genres: genreIds.map((id) => labels[id]).filter((label): label is string => Boolean(label)),
    officialWebsite: getClaimStringValue(entity, "P856") ?? null,
    foundedOrBirthYear: getClaimTimeYear(entity, "P571") ?? getClaimTimeYear(entity, "P569") ?? null,
  };
}

async function resolveArtist(artistName: string) {
  const candidates = await searchWikidataCandidates(artistName, MAX_CANDIDATES);
  if (candidates.length === 0) {
    return { ranked: [], entities: {} as Record<string, WikidataEntity> };
  }

  const entities = await fetchWikidataEntities(candidates.map((candidate) => candidate.id));
  const ranked = rankCandidates(candidates, artistName, (candidate) => {
    const entity = entities[candidate.id];
    return {
      hasWikipediaSitelink: entity ? Boolean(getWikipediaSitelink(entity)) : false,
      hasImage: entity ? hasClaim(entity, "P18") : false,
    };
  });

  return { ranked, entities };
}

async function upsertMetadata(supabase: SupabaseClient, row: MetadataRow): Promise<MetadataRow> {
  const { data, error } = await supabase
    .from("artist_external_metadata")
    .upsert(row, { onConflict: "normalized_artist_name" })
    .select()
    .single();

  if (error) {
    throw new HttpError(500, "No se pudo guardar la metadata del artista.", {
      code: "metadata_upsert_failed",
      details: error,
      exposeDetails: false,
    });
  }

  return data as MetadataRow;
}

export async function handleEnrichArtistMetadataRequest(
  req: Request,
  deps: { supabase: SupabaseClient },
): Promise<Response> {
  const { supabase } = deps;

  await requireAuthenticatedRole(supabase, req, {
    allowedRoles: ALLOWED_ROLES,
    logContext: "enrich-artist-metadata",
    forbiddenMessage: "No tienes permisos para consultar la metadata de artistas.",
  });

  const body = await readJsonBody<EnrichRequestBody>(req, {
    message: "El cuerpo de la solicitud no es JSON válido.",
  });
  const mode = body.mode ?? "lookup";
  const artistName = typeof body.artistName === "string" ? body.artistName.trim() : "";

  if (!artistName) {
    throw new HttpError(400, "Falta el nombre del artista.", { code: "missing_artist_name" });
  }

  if (mode === "search") {
    const { ranked } = await resolveArtist(artistName);
    return jsonResponse({
      candidates: ranked.slice(0, MAX_SEARCH_RESULTS).map(({ candidate, score, confidence }) => ({
        qid: candidate.id,
        label: candidate.label,
        description: candidate.description ?? null,
        score,
        confidence,
      })),
    });
  }

  const normalizedArtistName = normalizeArtistName(artistName);

  if (mode === "override") {
    const qid = typeof body.qid === "string" ? body.qid.trim().toUpperCase() : "";
    if (!/^Q\d+$/.test(qid)) {
      throw new HttpError(400, "El QID de Wikidata no es válido (debe tener el formato Q123).", {
        code: "invalid_qid",
      });
    }

    const entities = await fetchWikidataEntities([qid]);
    const entity = entities[qid];
    if (!entity) {
      throw new HttpError(404, "No se encontró esa entidad en Wikidata.", { code: "qid_not_found" });
    }

    const details = await resolveEntityDetails(entity);
    const row: MetadataRow = {
      normalized_artist_name: normalizedArtistName,
      display_artist_name: artistName,
      wikidata_qid: qid,
      wikipedia_lang: details.wikipediaLang,
      wikipedia_title: details.wikipediaTitle,
      wikipedia_url: details.wikipediaUrl,
      description: details.description,
      extract: details.extract,
      thumbnail_url: details.thumbnailUrl,
      country: details.country,
      genres: details.genres,
      founded_or_birth_year: details.foundedOrBirthYear,
      official_website: details.officialWebsite,
      match_confidence: 1,
      match_status: "manual",
      source: "manual",
      last_checked_at: new Date().toISOString(),
    };

    return jsonResponse(mapRowToResponse(await upsertMetadata(supabase, row)));
  }

  // mode === "lookup"
  if (!body.forceRefresh) {
    const { data: cached } = await supabase
      .from("artist_external_metadata")
      .select("*")
      .eq("normalized_artist_name", normalizedArtistName)
      .maybeSingle();

    if (cached) {
      const lastChecked = cached.last_checked_at ? new Date(cached.last_checked_at as string).getTime() : 0;
      const isFresh = Date.now() - lastChecked < CACHE_TTL_MS;
      if (isFresh && cached.match_status !== "pending") {
        return jsonResponse(mapRowToResponse(cached as MetadataRow));
      }
    }
  }

  const { ranked, entities } = await resolveArtist(artistName);
  const best = ranked[0];
  const entity = best ? entities[best.candidate.id] : undefined;
  const details = entity ? await resolveEntityDetails(entity) : EMPTY_DETAILS;
  const matchStatus = resolveMatchStatus(ranked.length, best?.confidence ?? 0);

  const row: MetadataRow = {
    normalized_artist_name: normalizedArtistName,
    display_artist_name: artistName,
    wikidata_qid: best?.candidate.id ?? null,
    wikipedia_lang: details.wikipediaLang,
    wikipedia_title: details.wikipediaTitle,
    wikipedia_url: details.wikipediaUrl,
    description: details.description,
    extract: details.extract,
    thumbnail_url: details.thumbnailUrl,
    country: details.country,
    genres: details.genres,
    founded_or_birth_year: details.foundedOrBirthYear,
    official_website: details.officialWebsite,
    match_confidence: best ? best.confidence : null,
    match_status: matchStatus,
    source: "wikimedia",
    last_checked_at: new Date().toISOString(),
  };

  return jsonResponse(mapRowToResponse(await upsertMetadata(supabase, row)));
}
