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
  const suffix = name.includes(".") ? name.split(".").at(-1)?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : "";
  return `${dept}/${jobId}/${objectId}${suffix ? "." + suffix : ""}`;
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
