import { describe, expect, it } from "vitest";
import {
  commonsImageUrl,
  getClaimEntityId,
  getClaimEntityIds,
  getClaimStringValue,
  getClaimTimeYear,
  getEntityDescription,
  getEntityLabel,
  getWikipediaSitelink,
  hasClaim,
  normalizeArtistName,
  rankCandidates,
  resolveMatchStatus,
  scoreCandidate,
  scoreToConfidence,
  type WikidataEntity,
  type WikidataSearchCandidate,
} from "../wikidata.ts";

describe("normalizeArtistName", () => {
  it("lowercases, strips accents, and collapses whitespace", () => {
    expect(normalizeArtistName("  Rosalía   ")).toBe("rosalia");
    expect(normalizeArtistName("Ñu")).toBe("nu");
    expect(normalizeArtistName("Café Quijano")).toBe("cafe quijano");
  });
});

describe("scoreCandidate", () => {
  const artistName = "Rosalía";

  it("scores an exact label match with a music description and Wikipedia/image bonuses at the max", () => {
    const candidate: WikidataSearchCandidate = {
      id: "Q383865",
      label: "Rosalía",
      description: "Spanish singer",
    };

    const score = scoreCandidate(candidate, artistName, { hasWikipediaSitelink: true, hasImage: true });
    expect(score).toBe(40 + 15 + 15 + 5);
  });

  it("scores an alias match lower than an exact label match", () => {
    const exact: WikidataSearchCandidate = { id: "Q1", label: "Rosalía", description: "singer" };
    const alias: WikidataSearchCandidate = {
      id: "Q2",
      label: "Rosalía Vila Tobella",
      description: "singer",
      matchType: "alias",
      matchText: "Rosalía",
    };

    expect(scoreCandidate(alias, artistName)).toBeLessThan(scoreCandidate(exact, artistName));
  });

  it("penalizes disambiguation pages", () => {
    const candidate: WikidataSearchCandidate = {
      id: "Q3",
      label: "Rosalía",
      description: "Wikimedia disambiguation page",
    };

    expect(scoreCandidate(candidate, artistName)).toBe(40 - 20);
  });

  it("does not credit a non-music entity with the music bonus", () => {
    const candidate: WikidataSearchCandidate = {
      id: "Q4",
      label: "Rosalía",
      description: "town in Galicia, Spain",
    };

    expect(scoreCandidate(candidate, artistName)).toBe(40);
  });
});

describe("scoreToConfidence / resolveMatchStatus", () => {
  it("clamps confidence to [0, 1]", () => {
    expect(scoreToConfidence(-30)).toBe(0);
    expect(scoreToConfidence(150)).toBe(1);
    expect(scoreToConfidence(50)).toBe(0.5);
  });

  it("reports no_match when there are no candidates", () => {
    expect(resolveMatchStatus(0, 0)).toBe("no_match");
  });

  it("reports matched above the confidence threshold", () => {
    expect(resolveMatchStatus(1, 0.55)).toBe("matched");
    expect(resolveMatchStatus(1, 0.9)).toBe("matched");
  });

  it("reports needs_review below the confidence threshold when candidates exist", () => {
    expect(resolveMatchStatus(3, 0.4)).toBe("needs_review");
  });
});

describe("rankCandidates", () => {
  it("sorts candidates by score, highest first", () => {
    const artistName = "Rosalía";
    const candidates: WikidataSearchCandidate[] = [
      { id: "Q-weak", label: "Rosalía", description: "town in Galicia, Spain" },
      { id: "Q-strong", label: "Rosalía", description: "Spanish singer" },
    ];

    const ranked = rankCandidates(candidates, artistName, (candidate) => ({
      hasWikipediaSitelink: candidate.id === "Q-strong",
      hasImage: candidate.id === "Q-strong",
    }));

    expect(ranked[0].candidate.id).toBe("Q-strong");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("returns an empty list for no candidates", () => {
    expect(rankCandidates([], "Rosalía")).toEqual([]);
  });
});

describe("Wikidata entity extraction helpers", () => {
  const entity: WikidataEntity = {
    id: "Q383865",
    labels: { es: { value: "Rosalía" }, en: { value: "Rosalia" } },
    descriptions: { es: { value: "cantante española" }, en: { value: "Spanish singer" } },
    sitelinks: { eswiki: { title: "Rosalía" }, enwiki: { title: "Rosalía (singer)" } },
    claims: {
      P18: [{ mainsnak: { datavalue: { value: "Rosalia.jpg" } } }],
      P495: [{ mainsnak: { datavalue: { value: { id: "Q29" } } } }],
      P136: [
        { mainsnak: { datavalue: { value: { id: "Q11399" } } } },
        { mainsnak: { datavalue: { value: { id: "Q484641" } } } },
      ],
      P569: [{ mainsnak: { datavalue: { value: { time: "+1992-09-25T00:00:00Z", precision: 11 } } } } as never],
      P856: [{ mainsnak: { datavalue: { value: "https://rosalia.example.com" } } }],
    },
  };

  it("prefers the requested language order for labels/descriptions", () => {
    expect(getEntityLabel(entity, ["es", "en"])).toBe("Rosalía");
    expect(getEntityLabel(entity, ["en", "es"])).toBe("Rosalia");
    expect(getEntityDescription(entity, ["es", "en"])).toBe("cantante española");
  });

  it("finds the Spanish Wikipedia sitelink before English", () => {
    expect(getWikipediaSitelink(entity)).toEqual({ lang: "es", title: "Rosalía" });
    expect(getWikipediaSitelink({ id: "Q0" }, ["eswiki", "enwiki"])).toBeNull();
  });

  it("reads string and entity-id claim values", () => {
    expect(getClaimStringValue(entity, "P18")).toBe("Rosalia.jpg");
    expect(getClaimStringValue(entity, "P856")).toBe("https://rosalia.example.com");
    expect(getClaimEntityId(entity, "P495")).toBe("Q29");
    expect(getClaimEntityIds(entity, "P136")).toEqual(["Q11399", "Q484641"]);
    expect(hasClaim(entity, "P18")).toBe(true);
    expect(hasClaim(entity, "P999")).toBe(false);
  });

  it("extracts a year out of a Wikidata time claim", () => {
    expect(getClaimTimeYear(entity, "P569")).toBe("1992");
    expect(getClaimTimeYear(entity, "P571")).toBeUndefined();
  });

  it("builds a Commons file URL with spaces encoded as underscores", () => {
    expect(commonsImageUrl("Rosalia performing 2023.jpg")).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Rosalia_performing_2023.jpg?width=400",
    );
  });
});
