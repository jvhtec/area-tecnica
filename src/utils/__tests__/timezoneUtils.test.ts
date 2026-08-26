import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
  getCalendarPeriodDateKeys,
  getMadridMonthGrid,
  isMadridToday,
  isMadridWeekend,
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

  it("returns Madrid month and year SQL boundaries near UTC midnight", () => {
    expect(getCalendarPeriodDateKeys(new Date("2026-05-31T22:30:00Z"))).toEqual({
      monthStart: "2026-06-01",
      monthEnd: "2026-06-30",
      yearStart: "2026-01-01",
      yearEnd: "2026-12-31",
      previousYearStart: "2025-01-01",
      previousYearEnd: "2025-12-31",
    });
  });

  it("handles leap-year month boundaries", () => {
    expect(getCalendarPeriodDateKeys(new Date("2024-02-15T12:00:00Z")).monthEnd).toBe("2024-02-29");
  });
});

describe("isMadridToday / isMadridWeekend", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats the Madrid calendar day as today, not the UTC one", () => {
    // 23:30 UTC is already the next day in Madrid (CEST, UTC+2).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T23:30:00Z"));

    expect(isMadridToday(new Date("2026-06-01T00:30:00Z"))).toBe(true);
    expect(isMadridToday(new Date("2026-05-31T12:00:00Z"))).toBe(false);
  });

  it("reads the weekday off the Madrid calendar day", () => {
    // 2026-05-30 is a Saturday; 22:30 UTC on the 29th is already the 30th in Madrid.
    expect(isMadridWeekend(new Date("2026-05-29T22:30:00Z"))).toBe(true);
    expect(isMadridWeekend(new Date("2026-05-29T12:00:00Z"))).toBe(false);
    expect(isMadridWeekend(new Date("2026-05-31T12:00:00Z"))).toBe(true);
    expect(isMadridWeekend(new Date("2026-06-01T12:00:00Z"))).toBe(false);
  });
});
