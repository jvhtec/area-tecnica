import { describe, expect, it } from "vitest";

import { buildJobDateTypeMap } from "@/utils/jobDateTypes";

describe("buildJobDateTypeMap", () => {
  it("indexes embedded rows by the job-card lookup key and skips undated rows", () => {
    const travel = { date: "2026-06-16", type: "travel" };

    expect(buildJobDateTypeMap("job-1", [travel, { date: null, type: "show" }])).toEqual({
      "job-1-2026-06-16": travel,
    });
  });
});
