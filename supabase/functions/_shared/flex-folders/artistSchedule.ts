import { HttpError } from "../http.ts";

const artistWallClock = (date: string, time: string): string => {
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) {
    throw new HttpError(400, "Invalid artist time");
  }
  return `${date}T${time.length === 5 ? `${time}:00` : time}.000Z`;
};

const nextDate = (date: string): string => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

/** Validates artist timing before a provisioning lease is acquired. */
export const buildArtistSchedule = (
  artist: {
    date: string;
    show_start: string | null;
    show_end: string | null;
    isaftermidnight: boolean | null;
  },
  dayStartTime: string,
) => {
  const startTime = String(artist.show_start || dayStartTime);
  const endTime = String(artist.show_end || dayStartTime);
  const endDate = artist.isaftermidnight || !artist.show_end ? nextDate(artist.date) : artist.date;
  const dateParts = artist.date.split("-");
  return {
    shortDate: `${dateParts[2]}${dateParts[1]}${dateParts[0].slice(-2)}`,
    schedule: {
      plannedStartDate: artistWallClock(artist.date, startTime),
      plannedEndDate: artistWallClock(endDate, endTime),
    },
  };
};
