export interface RfIemScheduleFields {
  loadInTime?: string;
  showStart?: string;
  showEnd?: string;
  soundcheckStart?: string;
  soundcheckEnd?: string;
  lineCheckStart?: string;
  lineCheckEnd?: string;
}

export type RawRfIemScheduleFields = {
  showStart?: unknown;
  show_start?: unknown;
  showEnd?: unknown;
  show_end?: unknown;
  loadInTime?: unknown;
  load_in_time?: unknown;
  soundcheckStart?: unknown;
  soundcheck_start?: unknown;
  soundcheckEnd?: unknown;
  soundcheck_end?: unknown;
  lineCheckStart?: unknown;
  line_check_start?: unknown;
  lineCheckEnd?: unknown;
  line_check_end?: unknown;
};

const pickString = (...values: unknown[]): string | undefined => {
  const value = values.find((entry) => typeof entry === "string");
  return typeof value === "string" ? value : undefined;
};

export const extractRfIemScheduleFields = (artist: RawRfIemScheduleFields): RfIemScheduleFields => ({
  loadInTime: pickString(artist.loadInTime, artist.load_in_time),
  showStart: pickString(artist.showStart, artist.show_start),
  showEnd: pickString(artist.showEnd, artist.show_end),
  soundcheckStart: pickString(artist.soundcheckStart, artist.soundcheck_start),
  soundcheckEnd: pickString(artist.soundcheckEnd, artist.soundcheck_end),
  lineCheckStart: pickString(artist.lineCheckStart, artist.line_check_start),
  lineCheckEnd: pickString(artist.lineCheckEnd, artist.line_check_end),
});

export const formatTimeRange = (start?: string, end?: string): string => {
  const safeStart = (start || "").trim();
  const safeEnd = (end || "").trim();
  if (!safeStart && !safeEnd) return "-";
  if (!safeStart) return `- ${safeEnd}`;
  if (!safeEnd) return `${safeStart} - -`;
  return `${safeStart} - ${safeEnd}`;
};

export const formatRfIemScheduleCell = (artist: RfIemScheduleFields): string =>
  [
    `Load: ${artist.loadInTime || "-"}`,
    `Show: ${formatTimeRange(artist.showStart, artist.showEnd)}`,
    `SC: ${formatTimeRange(artist.soundcheckStart, artist.soundcheckEnd)}`,
    `Line: ${formatTimeRange(artist.lineCheckStart, artist.lineCheckEnd)}`,
  ].join("\n");
