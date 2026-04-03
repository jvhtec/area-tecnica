import type { JobType } from "@/types/job";

export const OPS_JOB_TYPES_WITH_DRYHIRE = [
  "single",
  "festival",
  "ciclo",
  "tourdate",
  "dryhire",
  "evento",
  "prep_day",
] as const;

export const OPS_JOB_TYPES_NO_DRYHIRE = [
  "single",
  "festival",
  "ciclo",
  "tourdate",
  "evento",
  "prep_day",
] as const;

export function isFestivalLikeJobType(jobType?: string | null): boolean {
  return jobType === "festival" || jobType === "ciclo";
}

export function isKnownJobType(jobType?: string | null): jobType is JobType {
  if (!jobType) return false;
  return [
    "single",
    "multi_day",
    "tour",
    "tourdate",
    "festival",
    "ciclo",
    "dryhire",
    "evento",
    "prep_day",
  ].includes(jobType);
}
