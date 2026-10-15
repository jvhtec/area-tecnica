import { describe, expect, it } from "vitest";

import { buildJobSearchTokens, matchesJobSearch } from "@/utils/jobSearch";

describe("jobSearch", () => {
  it("builds accent-insensitive tokens", () => {
    expect(buildJobSearchTokens("  Fiesta  MÁLAGA ")).toEqual(["fiesta", "malaga"]);
    expect(buildJobSearchTokens("   ")).toEqual([]);
  });

  it("requires every token to match the title or the location", () => {
    const job = {
      title: "Concierto Sánchez",
      location: { name: "WiZink Center", formatted_address: "Av. Felipe II, Madrid" },
    };
    expect(matchesJobSearch(job, buildJobSearchTokens("sanchez wizink"))).toBe(true);
    expect(matchesJobSearch(job, buildJobSearchTokens("madrid"))).toBe(true);
    expect(matchesJobSearch(job, buildJobSearchTokens("sanchez barcelona"))).toBe(false);
  });

  it("accepts a location embedded as an array", () => {
    const job = { title: "Gala", location: [{ name: "Teatro Real", formatted_address: null }] };
    expect(matchesJobSearch(job, buildJobSearchTokens("teatro"))).toBe(true);
  });

  it("matches everything with no tokens and tolerates missing fields", () => {
    expect(matchesJobSearch({ title: null, location: null }, [])).toBe(true);
    expect(matchesJobSearch({ title: null, location: null }, ["x"])).toBe(false);
  });
});
