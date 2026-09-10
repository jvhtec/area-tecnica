import { describe, expect, it } from "vitest";

import {
  formatDifferentScheduleDate,
  getEffectiveSoundcheckDate,
  rebaseSoundcheckDate,
} from "@/utils/artistScheduleDates";

describe("artist schedule dates", () => {
  it("uses the show date for legacy artists without a soundcheck date override", () => {
    expect(
      getEffectiveSoundcheckDate({
        date: "2026-09-10",
        soundcheck_date: null,
      }),
    ).toBe("2026-09-10");
  });

  it("keeps a soundcheck explicitly scheduled on the previous setup day", () => {
    expect(
      getEffectiveSoundcheckDate({
        date: "2026-09-10",
        soundcheck_date: "2026-09-09",
      }),
    ).toBe("2026-09-09");

    expect(formatDifferentScheduleDate("2026-09-09", "2026-09-10")).toBe("09/09");
  });

  it("does not repeat the date for a same-day soundcheck", () => {
    expect(formatDifferentScheduleDate("2026-09-10", "2026-09-10")).toBe("");
  });

  it("preserves the relative day when copying an artist to another festival date", () => {
    expect(
      rebaseSoundcheckDate({
        soundcheckDate: "2026-09-09",
        sourceShowDate: "2026-09-10",
        targetShowDate: "2026-09-17",
      }),
    ).toBe("2026-09-16");
  });
});
