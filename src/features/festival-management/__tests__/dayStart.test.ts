import { describe, expect, it } from "vitest";

import {
  DEFAULT_FESTIVAL_DAY_START_TIME,
  getFestivalDayOffset,
  getFestivalDayStartMinutes,
  isBeforeFestivalDayStart,
  normalizeFestivalDayStartTime,
  parseFestivalClockMinutes,
} from "@/features/festival-management/dayStart";

describe("festival day start", () => {
  it("normalizes database time values and invalid input through one default", () => {
    expect(normalizeFestivalDayStartTime("06:30:00")).toBe("06:30");
    expect(normalizeFestivalDayStartTime("7:05")).toBe("07:05");
    expect(normalizeFestivalDayStartTime("invalid")).toBe(DEFAULT_FESTIVAL_DAY_START_TIME);
    expect(normalizeFestivalDayStartTime(null)).toBe(DEFAULT_FESTIVAL_DAY_START_TIME);
  });

  it("parses valid clocks and rejects invalid clocks", () => {
    expect(parseFestivalClockMinutes("06:30:59")).toBe(390);
    expect(parseFestivalClockMinutes("24:00")).toBeNull();
    expect(parseFestivalClockMinutes("06:60")).toBeNull();
  });

  it("positions times against a non-default boundary", () => {
    expect(getFestivalDayStartMinutes("09:30")).toBe(570);
    expect(getFestivalDayOffset("09:30", "09:30")).toBe(0);
    expect(getFestivalDayOffset("08:30", "09:30")).toBe(23 * 60);
    expect(isBeforeFestivalDayStart("08:30", "09:30")).toBe(true);
    expect(isBeforeFestivalDayStart("10:00", "09:30")).toBe(false);
  });
});
