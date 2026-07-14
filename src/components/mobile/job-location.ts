/**
 * Resolves a job's display location across the several shapes jobs arrive in
 * (joined relation, legacy string column, location_data, venue fields).
 * Shared by the mobile hubs so every card falls back identically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getJobLocationName = (job: any): string =>
  (typeof job.location === "string" && job.location) ||
  job.location?.name ||
  job.location?.formatted_address ||
  job.location_data?.name ||
  job.location_data?.formatted_address ||
  job.locations?.name ||
  job.venue_name ||
  job.venue ||
  "Sin ubicación";
