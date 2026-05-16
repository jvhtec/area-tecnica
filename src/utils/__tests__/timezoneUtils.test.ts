import { describe, expect, it } from "vitest";

import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
  getMadridMonthGrid,
} from "@/utils/timezoneUtils";

describe("timezoneUtils Madrid calendar helpers", () => {
  it("formats UTC instants as Madrid local date keys", () => {
    expect(formatMadridDateKey(new Date("2026-03-28T22:59:59Z"))).toBe("2026-03-28");
    expect(formatMadridDateKey(new Date("2026-03-28T23:00:00Z"))).toBe("2026-03-29");
  });

  it("steps calendar days across the spring DST transition", () => {
    expect(addMadridCalendarDays("2026-03-29", 1)).toBe("2026-03-30");

    const start = fromMadridDateKey("2026-03-29");
    const next = fromMadridDateKey("2026-03-30");
    expect(next.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("steps calendar days across the autumn DST transition", () => {
    expect(addMadridCalendarDays("2026-10-25", 1)).toBe("2026-10-26");

    const start = fromMadridDateKey("2026-10-25");
    const next = fromMadridDateKey("2026-10-26");
    expect(next.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("builds a Monday-start 42-day Madrid month grid", () => {
    const grid = getMadridMonthGrid(new Date("2026-03-15T12:00:00Z"));

    expect(grid.monthStartKey).toBe("2026-03-01");
    expect(grid.gridStartKey).toBe("2026-02-23");
    expect(grid.gridEndKey).toBe("2026-04-05");
    expect(grid.dateKeys).toHaveLength(42);
  });
});
