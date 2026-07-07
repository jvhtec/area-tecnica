// Thin network layer for Wikidata/Wikipedia. Kept separate from wikidata.ts so
// the scoring/parsing logic stays pure and unit-testable while this file
// (network calls, timeouts, User-Agent) only runs for real inside Deno.
//
// Wikimedia's API usage guidelines ask clients to identify themselves with a
// descriptive User-Agent including contact info, rather than a generic/default
// agent: https://meta.wikimedia.org/wiki/User-Agent_policy

import type { WikidataEntity, WikidataSearchCandidate } from "./wikidata.ts";

const WIKIMEDIA_USER_AGENT =
  "AreaTecnica-RiderLibrary/1.0 (https://sector-pro.work; jvadillotecnico@gmail.com)";
const FETCH_TIMEOUT_MS = 8000;
const SEARCH_LANGS = ["es", "en"];

function wikimediaFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": WIKIMEDIA_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

// deno-lint-ignore no-explicit-any
type JsonAny = any;

/**
 * Searches Wikidata for candidate entities matching `artistName`, trying
 * Spanish first (per Wikidata's own guidance: search first, don't guess a QID
 * and query the SPARQL service blind).
 */
export async function searchWikidataCandidates(
  artistName: string,
  limit = 5,
): Promise<WikidataSearchCandidate[]> {
  for (const lang of SEARCH_LANGS) {
    const params = new URLSearchParams({
      action: "wbsearchentities",
      search: artistName,
      language: lang,
      uselang: lang,
      format: "json",
      limit: String(limit),
      type: "item",
    });

    try {
      const res = await wikimediaFetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`enrich-artist-metadata: Wikidata search rate-limited (retry-after ${res.headers.get("retry-after")})`);
        }
        continue;
      }

      const data: JsonAny = await res.json();
      const results: JsonAny[] = Array.isArray(data?.search) ? data.search : [];
      if (results.length === 0) continue;

      return results.map((entry) => ({
        id: entry.id,
        label: entry.label ?? entry.id,
        description: entry.description,
        matchType: entry.match?.type,
        matchText: entry.match?.text,
      }));
    } catch (err) {
      console.warn(`enrich-artist-metadata: Wikidata search (${lang}) failed:`, err);
    }
  }

  return [];
}

/** Batches a `wbgetentities` lookup for up to a handful of QIDs in one request. */
export async function fetchWikidataEntities(ids: string[]): Promise<Record<string, WikidataEntity>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: uniqueIds.join("|"),
    props: "labels|descriptions|sitelinks|claims",
    languages: "es|en",
    sitefilter: "eswiki|enwiki",
    format: "json",
  });

  try {
    const res = await wikimediaFetch(`https://www.wikidata.org/w/api.php?${params.toString()}`);
    if (!res.ok) return {};
    const data: JsonAny = await res.json();
    return (data?.entities ?? {}) as Record<string, WikidataEntity>;
  } catch (err) {
    console.warn("enrich-artist-metadata: wbgetentities failed:", err);
    return {};
  }
}

/** Resolves display labels for a small set of QIDs (used for genre/country claims). */
export async function fetchEntityLabels(ids: string[]): Promise<Record<string, string>> {
  const entities = await fetchWikidataEntities(ids);
  const labels: Record<string, string> = {};

  for (const [id, entity] of Object.entries(entities)) {
    const label = entity.labels?.es?.value ?? entity.labels?.en?.value;
    if (label) labels[id] = label;
  }

  return labels;
}

export type WikipediaSummary = {
  description?: string;
  extract?: string;
  thumbnailUrl?: string;
  canonicalUrl?: string;
};

/** Fetches the short human-readable summary card for a Wikipedia article. */
export async function fetchWikipediaSummary(lang: string, title: string): Promise<WikipediaSummary | null> {
  try {
    const res = await wikimediaFetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!res.ok) return null;

    const data: JsonAny = await res.json();
    return {
      description: data?.description,
      extract: data?.extract,
      thumbnailUrl: data?.thumbnail?.source,
      canonicalUrl: data?.content_urls?.desktop?.page,
    };
  } catch (err) {
    console.warn(`enrich-artist-metadata: Wikipedia summary (${lang}/${title}) failed:`, err);
    return null;
  }
}
