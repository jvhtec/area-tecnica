import { describe, expect, it } from "vitest";

import {
  UNASSIGNED_PRODUCER,
  buildProducerOptions,
  collectProducerNames,
  matchesProducerFilter,
} from "@/components/project-management/producerFilter";

const claimed = (...ids: string[]) => ({
  job_type: "single",
  job_producer_claims: ids.map((id) => ({ producer_id: id, display_name: `Nombre ${id}` })),
});

describe("matchesProducerFilter", () => {
  it("shows everything when no producer is selected", () => {
    expect(matchesProducerFilter(claimed(), [])).toBe(true);
    expect(matchesProducerFilter(claimed("p1"), [])).toBe(true);
  });

  it("matches jobs any selected producer is carrying", () => {
    expect(matchesProducerFilter(claimed("p1", "p2"), ["p2"])).toBe(true);
    expect(matchesProducerFilter(claimed("p1"), ["p3"])).toBe(false);
  });

  it("treats unclaimed jobs as 'sin responsable', except dry hires", () => {
    expect(matchesProducerFilter(claimed(), [UNASSIGNED_PRODUCER])).toBe(true);
    expect(matchesProducerFilter({ job_type: "dryhire", job_producer_claims: [] }, [UNASSIGNED_PRODUCER])).toBe(false);
    expect(matchesProducerFilter(claimed("p1"), [UNASSIGNED_PRODUCER])).toBe(false);
    expect(matchesProducerFilter(claimed(), ["p1", UNASSIGNED_PRODUCER])).toBe(true);
  });
});

describe("buildProducerOptions", () => {
  it("lists producers once, current user first, then by name", () => {
    const jobs = [
      { job_producer_claims: [{ producer_id: "z", display_name: "Zoe" }, { producer_id: "me", display_name: "Marta" }] },
      { job_producer_claims: [{ producer_id: "a", display_name: "Álvaro" }, { producer_id: "z", display_name: "Zoe" }] },
    ];
    expect(buildProducerOptions(jobs, "me", [], new Map()).map((o) => [o.id, o.isCurrentUser])).toEqual([
      ["me", true],
      ["a", false],
      ["z", false],
    ]);
  });

  it("keeps a selected producer with no job in view, named from earlier months", () => {
    const options = buildProducerOptions([], null, ["gone", UNASSIGNED_PRODUCER], new Map([["gone", "Luis"]]));
    expect(options).toEqual([{ id: "gone", label: "Luis", isCurrentUser: false }]);
  });
});

describe("collectProducerNames", () => {
  it("remembers names across calls", () => {
    const names = collectProducerNames([claimed("p1")], new Map());
    collectProducerNames([claimed("p2")], names);
    expect(Array.from(names.keys())).toEqual(["p1", "p2"]);
  });
});
