import { afterEach, describe, expect, it, vi } from "vitest";
import { es } from "date-fns/locale";

import {
  addMadridCalendarDays,
  formatMadridDateKey,
  fromMadridDateKey,
  getCalendarPeriodDateKeys,
  getMadridMonthGrid,
  isMadridToday,
  isMadridWeekend,
  formatMadridDayKey,
  getDayBoundsInTimezone,
  isJobOnDate,
  madridDateKeyToCalendarDate,
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

  // These read a day key rather than an instant. Reparsing a bare "yyyy-MM-dd"
  // as a local midnight put it on the previous Madrid day everywhere east of
  // Madrid, so under TZ=Asia/Tokyo the weekday came back off by one and a
  // Saturday column was not shaded as a weekend.
  it("keeps a day key on its own day, whatever the browser timezone", () => {
    expect(formatMadridDateKey("2026-03-12")).toBe("2026-03-12");
    // 2026-03-14 is a Saturday and 2026-03-13 a Friday, on the Madrid calendar.
    expect(isMadridWeekend("2026-03-14")).toBe(true);
    expect(isMadridWeekend("2026-03-13")).toBe(false);
  });

  it("still converts a timestamp string to the Madrid day it falls on", () => {
    // 23:30 UTC on the 12th is already the 13th in Madrid (CET, UTC+1).
    expect(formatMadridDateKey("2026-03-12T23:30:00Z")).toBe("2026-03-13");
    expect(formatMadridDateKey("2026-03-12T09:00:00Z")).toBe("2026-03-12");
  });

  it("treats a day key as today on the Madrid calendar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-31T23:30:00Z"));

    expect(isMadridToday("2026-06-01")).toBe(true);
    expect(isMadridToday("2026-05-31")).toBe(false);
  });
});

describe("madridDateKeyToCalendarDate", () => {
  it("returns the local calendar day a picker should render", () => {
    const d = madridDateKeyToCalendarDate("2026-06-01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(1);
  });

  it("rejects malformed and impossible calendar days", () => {
    expect(madridDateKeyToCalendarDate("")).toBeNull();
    expect(madridDateKeyToCalendarDate("2026-6-1")).toBeNull();
    expect(madridDateKeyToCalendarDate("not-a-date")).toBeNull();
    // Date would silently roll these over (Feb 30 -> Mar 2, month 13 -> Jan).
    expect(madridDateKeyToCalendarDate("2026-02-30")).toBeNull();
    expect(madridDateKeyToCalendarDate("2026-13-05")).toBeNull();
    expect(madridDateKeyToCalendarDate("2026-04-31")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(madridDateKeyToCalendarDate("2024-02-29")).not.toBeNull();
    expect(madridDateKeyToCalendarDate("2026-02-29")).toBeNull();
  });
});

describe("getDayBoundsInTimezone", () => {
  // The argument is a calendar day off a grid (a local midnight meaning
  // "22 July"), not an instant. Converting that instant into the job timezone
  // first moved it onto the neighbouring day whenever the browser and the job
  // disagreed, and a job vanished from its own calendar cell.
  it("bounds the calendar day the caller asked for", () => {
    const { start, end } = getDayBoundsInTimezone(new Date(2026, 6, 22), "Europe/Madrid");

    // July: Madrid is UTC+2, so the day runs 22:00Z the previous day to 21:59:59.999Z.
    expect(start.toISOString()).toBe("2026-07-21T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-22T21:59:59.999Z");
  });

  it("keeps a job inside the day it falls on", () => {
    expect(isJobOnDate("2026-07-22T08:00:00Z", "2026-07-22T18:00:00Z", new Date(2026, 6, 22))).toBe(true);
    expect(isJobOnDate("2026-07-22T08:00:00Z", "2026-07-22T18:00:00Z", new Date(2026, 6, 21))).toBe(false);
    expect(isJobOnDate("2026-07-22T08:00:00Z", "2026-07-22T18:00:00Z", new Date(2026, 6, 23))).toBe(false);
  });

  it("spans the 23- and 25-hour days either side of a DST change", () => {
    // 2026-03-29 is 23 hours in Madrid, 2026-10-25 is 25.
    const spring = getDayBoundsInTimezone(new Date(2026, 2, 29), "Europe/Madrid");
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 60 * 60 * 1000 - 1);

    const autumn = getDayBoundsInTimezone(new Date(2026, 9, 25), "Europe/Madrid");
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 60 * 60 * 1000 - 1);
  });
});

describe("formatMadridDayKey", () => {
  // formatInTimeZone(parseISO(key), ...) looks equivalent and is not: parseISO
  // gives a local midnight, which east of Madrid is still the previous Madrid
  // day, so a payout row for 2026-04-08 read "mar 7 abr" under TZ=Asia/Tokyo.
  it("names the day the key names", () => {
    expect(formatMadridDayKey("2026-04-08", "yyyy-MM-dd")).toBe("2026-04-08");
    expect(formatMadridDayKey("2026-01-01", "yyyy-MM-dd")).toBe("2026-01-01");
    expect(formatMadridDayKey("2026-12-31", "yyyy-MM-dd")).toBe("2026-12-31");
  });

  it("formats with the requested pattern", () => {
    expect(formatMadridDayKey("2026-04-08", "EEE d MMM", { locale: es })).toBe("mié 8 abr");
  });
});
