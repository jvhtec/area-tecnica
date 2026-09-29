export const DEFAULT_FESTIVAL_DAY_START_TIME = "07:00";

const CLOCK_TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const MINUTES_PER_DAY = 24 * 60;

/** Returns a valid festival boundary, falling back only to the shared product default. */
export const normalizeFestivalDayStartTime = (value: string | null | undefined): string => {
  const match = value?.trim().match(CLOCK_TIME_PATTERN);
  return match
    ? `${match[1].padStart(2, "0")}:${match[2]}`
    : DEFAULT_FESTIVAL_DAY_START_TIME;
};

/** Parses a clock value into minutes past midnight. */
export const parseFestivalClockMinutes = (value: string | null | undefined): number | null => {
  const match = value?.trim().match(CLOCK_TIME_PATTERN);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

export const getFestivalDayStartMinutes = (dayStartTime: string | null | undefined): number =>
  parseFestivalClockMinutes(normalizeFestivalDayStartTime(dayStartTime))
  ?? parseFestivalClockMinutes(DEFAULT_FESTIVAL_DAY_START_TIME)!;

/** Position of a clock time within the configured 24-hour festival day. */
export const getFestivalDayOffset = (
  value: string | null | undefined,
  dayStartTime: string | null | undefined,
): number | null => {
  const minutes = parseFestivalClockMinutes(value);
  if (minutes === null) return null;
  return (minutes - getFestivalDayStartMinutes(dayStartTime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
};

export const isBeforeFestivalDayStart = (
  value: string | null | undefined,
  dayStartTime: string | null | undefined,
): boolean => {
  const minutes = parseFestivalClockMinutes(value);
  return minutes !== null && minutes < getFestivalDayStartMinutes(dayStartTime);
};
