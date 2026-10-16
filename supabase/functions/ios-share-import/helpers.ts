// Pure helpers for ios-share-import, kept free of Deno/Supabase imports so
// they can be unit tested with Vitest.

export const STALE_UPLOAD_MS = 10 * 60_000;

/** Escapes LIKE metacharacters so a search term is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Validates the display filename. The exact name is preserved, but path
 * separators and control characters are rejected. Returns null when invalid.
 */
export function validFileName(value: string): string | null {
  const invalid = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || code === 47 || code === 92;
  });
  if (!value || value.length > 255 || invalid || value === "." || value === "..") return null;
  return value;
}

/**
 * Storage key, separate from the display name. Unknown and Unicode extensions
 * are allowed; the key keeps only characters that are safe for Storage.
 */
export function objectPath(dept: string, jobId: string, name: string, objectId: string): string {
  return `${dept}/${jobId}/${objectId}${safeSuffix(name)}`;
}

export type JobRow = {
  id: string;
  title: string | null;
  start_time: string | null;
  job_type: string | null;
  tour_id: string | null;
  tour_date_id: string | null;
  tourName?: string | null;
};

/**
 * One line per job for the Shortcuts "Choose from List" action. The UUID is
 * last because the Shortcut splits by " | " and takes the Last Item.
 */
export function jobOption(job: JobRow): string {
  const clean = (value: string) => value.replace(/[\r\n|]/g, " ").trim();
  const date = job.start_time ? String(job.start_time).slice(0, 10) : "sin fecha";
  const title = clean(String(job.title ?? "Sin título")).slice(0, 110);
  const tour = job.tourName ? clean(job.tourName).slice(0, 60) : "";
  const type = job.job_type === "tourdate"
    ? (tour ? `Fecha de gira (${tour})` : "Fecha de gira")
    : job.job_type === "tour"
    ? "Gira"
    : String(job.job_type || "Trabajo");
  return `${date} | ${type} | ${title} | ${job.id}`;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** Dry hire jobs are equipment-only: they have no artists or riders. */
export const RIDER_EXCLUDED_JOB_TYPES = ["dryhire"] as const;

export function acceptsRiders(jobType: string | null): boolean {
  return !(RIDER_EXCLUDED_JOB_TYPES as readonly string[]).includes(jobType ?? "");
}

export type Destination = "document" | "rider";

/** Characters Storage keys can safely carry from the original extension. */
function safeSuffix(name: string): string {
  const suffix = name.includes(".") ? name.split(".").at(-1)?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : "";
  return suffix ? "." + suffix : "";
}

/** Tour documents live under `tours/<tour>/<uuid>.<ext>`, like the web upload. */
export function tourDocumentPath(tourId: string, name: string, objectId: string): string {
  return `tours/${tourId}/${objectId}${safeSuffix(name)}`;
}

/** Rider objects live under the artist id, like the web upload (`<artist>/<uuid>.<ext>`). */
export function riderPath(artistId: string, name: string, objectId: string): string {
  return `${artistId}/${objectId}${safeSuffix(name)}`;
}

/** Artist names are free text; keep them single-line and bounded. Null when unusable. */
export function validArtistName(value: string): string | null {
  const name = value.replace(/\s+/g, " ").trim();
  const invalid = [...name].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  return !name || name.length > 120 || invalid ? null : name;
}

/** Calendar date (YYYY-MM-DD) as written by the Shortcut; null unless it is a real date. */
export function validIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value ? value : null;
}

const MADRID_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" });

/** The Madrid calendar date (YYYY-MM-DD) of an instant. */
export function madridDate(value: string | Date): string {
  return MADRID_DATE.format(typeof value === "string" ? new Date(value) : value);
}

/**
 * Start of "today" in Madrid, as an ISO instant, for the upcoming-jobs filter.
 * Uses the summer offset (UTC+2), so in winter it errs an hour early, which
 * only keeps a job that ended just before midnight visible a little longer.
 */
export function upcomingCutoffIso(now: Date = new Date()): string {
  const [year, month, day] = madridDate(now).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - 2 * 3_600_000).toISOString();
}
