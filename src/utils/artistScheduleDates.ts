const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ArtistSoundcheckDateSource {
  date?: string | null;
  soundcheck_date?: string | null;
}

const parseIsoDateUtc = (value?: string | null): number | null => {
  if (!value) return null;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
};

export const getEffectiveSoundcheckDate = ({
  date,
  soundcheck_date,
}: ArtistSoundcheckDateSource): string => soundcheck_date || date || "";

export const formatScheduleDate = (
  value?: string | null,
  options: { language?: "es" | "en"; includeYear?: boolean } = {},
): string => {
  const timestamp = parseIsoDateUtc(value);
  if (timestamp === null) return value || "";
  const parsed = new Date(timestamp);
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();
  return options.includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
};

export const formatDifferentScheduleDate = (
  eventDate?: string | null,
  referenceDate?: string | null,
  options: { language?: "es" | "en"; includeYear?: boolean } = {},
): string => {
  if (!eventDate || !referenceDate || eventDate === referenceDate) return "";
  return formatScheduleDate(eventDate, options);
};

export const rebaseSoundcheckDate = ({
  soundcheckDate,
  sourceShowDate,
  targetShowDate,
}: {
  soundcheckDate?: string | null;
  sourceShowDate?: string | null;
  targetShowDate?: string | null;
}): string | null => {
  if (!soundcheckDate) return null;

  const soundcheckTimestamp = parseIsoDateUtc(soundcheckDate);
  const sourceTimestamp = parseIsoDateUtc(sourceShowDate);
  const targetTimestamp = parseIsoDateUtc(targetShowDate);
  if (soundcheckTimestamp === null || sourceTimestamp === null || targetTimestamp === null) {
    return soundcheckDate;
  }

  const dayOffset = Math.round((soundcheckTimestamp - sourceTimestamp) / DAY_MS);
  return new Date(targetTimestamp + dayOffset * DAY_MS).toISOString().slice(0, 10);
};
