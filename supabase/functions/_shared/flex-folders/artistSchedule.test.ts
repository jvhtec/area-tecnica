import { describe, expect, it } from "vitest";

import { buildArtistSchedule } from "./artistSchedule.ts";

describe("artist extras schedule preflight", () => {
  it("rejects an invalid persisted artist time before provisioning", () => {
    expect(() => buildArtistSchedule({
      date: "2026-09-08",
      show_start: "25:00",
      show_end: "23:30",
      isaftermidnight: false,
    }, "07:00")).toThrow("Invalid artist time");
  });

  it("moves an overnight end time to the following festival date", () => {
    expect(buildArtistSchedule({
      date: "2026-09-08",
      show_start: "23:00",
      show_end: "01:00",
      isaftermidnight: true,
    }, "07:00").schedule).toEqual({
      plannedStartDate: "2026-09-08T23:00:00.000Z",
      plannedEndDate: "2026-09-09T01:00:00.000Z",
    });
  });
});
