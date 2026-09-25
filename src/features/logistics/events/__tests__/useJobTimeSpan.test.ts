import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: {} }));

import { jobTimeSpanToLocal } from "../useJobTimeSpan";

describe("jobTimeSpanToLocal", () => {
  it("gives the job's span as Madrid wall-clock values", () => {
    expect(jobTimeSpanToLocal({ start_time: "2026-09-30T18:00:00Z", end_time: "2026-10-02T21:00:00Z" })).toEqual({
      startDate: "2026-09-30",
      startTime: "20:00",
      endDate: "2026-10-02",
      endTime: "23:00",
    });
  });

  it("uses the job's own timezone when it has one", () => {
    expect(jobTimeSpanToLocal({ start_time: "2026-09-30T18:00:00Z", end_time: "2026-10-01T01:00:00Z", timezone: "Europe/London" }))
      .toMatchObject({ startTime: "19:00", endDate: "2026-10-01", endTime: "02:00" });
  });

  it("has no span without both ends in order", () => {
    expect(jobTimeSpanToLocal({ start_time: null, end_time: "2026-10-02T21:00:00Z" })).toBeNull();
    expect(jobTimeSpanToLocal({ start_time: "2026-10-02T21:00:00Z", end_time: "2026-10-02T21:00:00Z" })).toBeNull();
  });
});
