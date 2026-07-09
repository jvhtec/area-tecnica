import { describe, expect, it } from "vitest";

import { parseStageScopeSegment } from "@/utils/jobDocuments/stageAwareLookup";

describe("stage-aware job document lookup helpers", () => {
  it("parses stage scopes from legacy and job-scoped generated document paths", () => {
    expect(
      parseStageScopeSegment(
        "calculators/consumos/job-1/stage-2-main/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBe("stage-2-main");

    expect(
      parseStageScopeSegment(
        "job-1/calculators/consumos/stage-2-main/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBe("stage-2-main");

    expect(
      parseStageScopeSegment(
        "job-1/calculators/consumos/copy-id-report.pdf",
        "job-1",
        "calculators/consumos"
      )
    ).toBeNull();
  });
});
