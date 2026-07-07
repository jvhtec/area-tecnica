// Pure helpers for scoring Wikidata search candidates and extracting fields
// from Wikidata entity JSON. No network calls here on purpose: keeping this
// side-effect free lets it run under both Deno (the real Edge Function) and
// Vitest (supabase/functions/enrich-artist-metadata/__tests__/wikidata.test.ts).

export type WikidataSearchCandidate = {
  id: string;
  label: string;
  description?: string;
  matchType?: string;
  matchText?: string;
};

export type WikidataClaimValue =
  | string
  | number
  | { id?: string; "entity-type"?: string; "numeric-id"?: number }
  | { time?: string; precision?: number }
  | Record<string, unknown>;

export type WikidataClaimSnak = {
  mainsnak?: {
    datavalue?: {
      value?: WikidataClaimValue;
    };
  };
};

export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string }>;
  claims?: Record<string, WikidataClaimSnak[]>;
};

const MUSIC_KEYWORDS = [
  "band",
  "banda",
  "singer",
  "cantante",
  "musician",
  "musico",
  "músico",
  "musical group",
  "grupo musical",
  "duo",
  "dúo",
  "orchestra",
  "orquesta",
  "rapper",
  "rock group",
  "rock band",
  "dj",
  "composer",
  "compositor",
  "singer-songwriter",
  "cantautor",
  "cantautora",
  "vocalist",
  "vocalista",
  "girl group",
  "boy band",
  "musical ensemble",
];

const DISAMBIGUATION_KEYWORDS = ["disambiguation", "desambiguación", "desambiguacion"];

/** Lowercases, strips accents, and collapses whitespace so names compare consistently. */
export function normalizeArtistName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function textIncludesAny(text: string | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export type ScoringContext = {
  hasWikipediaSitelink?: boolean;
  hasImage?: boolean;
};

/**
 * score = exactNameMatch*40 + aliasMatch*25 + hasWikipediaPage*15
 *       + isMusicEntity*15 + hasImage*5 - disambiguationPenalty*20
 */
export function scoreCandidate(
  candidate: WikidataSearchCandidate,
  artistName: string,
  context: ScoringContext = {},
): number {
  const normalizedArtist = normalizeArtistName(artistName);
  const normalizedLabel = normalizeArtistName(candidate.label);
  const exactNameMatch = normalizedLabel === normalizedArtist;
  const aliasMatch =
    !exactNameMatch &&
    candidate.matchType === "alias" &&
    normalizeArtistName(candidate.matchText ?? "") === normalizedArtist;
  const isMusicEntity = textIncludesAny(candidate.description, MUSIC_KEYWORDS);
  const isDisambiguation = textIncludesAny(candidate.description, DISAMBIGUATION_KEYWORDS);

  let score = 0;
  score += exactNameMatch ? 40 : 0;
  score += aliasMatch ? 25 : 0;
  score += context.hasWikipediaSitelink ? 15 : 0;
  score += isMusicEntity ? 15 : 0;
  score += context.hasImage ? 5 : 0;
  score -= isDisambiguation ? 20 : 0;

  return score;
}

const MAX_SCORE = 100;

export function scoreToConfidence(score: number): number {
  return Math.max(0, Math.min(1, score / MAX_SCORE));
}

export type MatchStatus = "matched" | "needs_review" | "no_match";

const MATCH_CONFIDENCE_THRESHOLD = 0.55;

export function resolveMatchStatus(candidateCount: number, confidence: number): MatchStatus {
  if (candidateCount === 0) return "no_match";
  return confidence >= MATCH_CONFIDENCE_THRESHOLD ? "matched" : "needs_review";
}

export type ScoredCandidate<T extends WikidataSearchCandidate = WikidataSearchCandidate> = {
  candidate: T;
  score: number;
  confidence: number;
};

/** Scores every candidate and returns them ranked highest-score first. */
export function rankCandidates<T extends WikidataSearchCandidate>(
  candidates: T[],
  artistName: string,
  contextFor: (candidate: T) => ScoringContext = () => ({}),
): ScoredCandidate<T>[] {
  return candidates
    .map((candidate) => {
      const score = scoreCandidate(candidate, artistName, contextFor(candidate));
      return { candidate, score, confidence: scoreToConfidence(score) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Returns the label in the first available language, preferring earlier entries in `langs`. */
export function getEntityLabel(entity: WikidataEntity, langs: string[]): string | undefined {
  for (const lang of langs) {
    const value = entity.labels?.[lang]?.value;
    if (value) return value;
  }
  return undefined;
}

export function getEntityDescription(entity: WikidataEntity, langs: string[]): string | undefined {
  for (const lang of langs) {
    const value = entity.descriptions?.[lang]?.value;
    if (value) return value;
  }
  return undefined;
}

export type WikipediaSitelink = { lang: string; title: string };

/** Finds the first matching Wikipedia sitelink, e.g. `eswiki` before `enwiki`. */
export function getWikipediaSitelink(
  entity: WikidataEntity,
  siteKeys: string[] = ["eswiki", "enwiki"],
): WikipediaSitelink | null {
  for (const siteKey of siteKeys) {
    const title = entity.sitelinks?.[siteKey]?.title;
    if (title) {
      return { lang: siteKey.replace(/wiki$/, ""), title };
    }
  }
  return null;
}

function firstClaimValue(entity: WikidataEntity, property: string): WikidataClaimValue | undefined {
  return entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
}

export function hasClaim(entity: WikidataEntity, property: string): boolean {
  return Boolean(entity.claims?.[property]?.length);
}

export function getClaimStringValue(entity: WikidataEntity, property: string): string | undefined {
  const value = firstClaimValue(entity, property);
  return typeof value === "string" ? value : undefined;
}

/** Reads every entity-id ("Q...") value out of a repeated statement, e.g. P136 genres. */
export function getClaimEntityIds(entity: WikidataEntity, property: string): string[] {
  const claims = entity.claims?.[property] ?? [];
  return claims
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .map((value) =>
      value && typeof value === "object" && "id" in value ? (value as { id?: string }).id : undefined,
    )
    .filter((id): id is string => Boolean(id));
}

export function getClaimEntityId(entity: WikidataEntity, property: string): string | undefined {
  return getClaimEntityIds(entity, property)[0];
}

/** Extracts just the year out of a Wikidata time value like "+1990-00-00T00:00:00Z". */
export function getClaimTimeYear(entity: WikidataEntity, property: string): string | undefined {
  const value = firstClaimValue(entity, property);
  if (value && typeof value === "object" && "time" in value) {
    const time = (value as { time?: string }).time;
    const match = time?.match(/^[+-](\d{1,})-/);
    return match ? String(Number(match[1])) : undefined;
  }
  return undefined;
}

/** Builds a Wikimedia Commons file URL from a P18 filename claim value. */
export function commonsImageUrl(fileName: string, widthPx = 400): string {
  const normalized = fileName.replace(/ /g, "_");
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}?width=${widthPx}`;
}
