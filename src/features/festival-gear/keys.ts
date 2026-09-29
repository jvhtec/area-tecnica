import { queryKeys } from "@/lib/react-query";

/** Query keys of the gear and stages sub-domain (the realtime subscriptions invalidate these prefixes). */
export const festivalGearKeys = {
  /** Prefix for everything gear-related of one festival. */
  all: (jobId: string | undefined) => queryKeys.scope("festival-gear", jobId),
  setup: (jobId: string | undefined, stageNumber: number) =>
    [...queryKeys.scope("festival-gear", jobId), "setup", stageNumber] as const,
  combined: (jobId: string | undefined, stageNumber: number) =>
    [...queryKeys.scope("festival-gear", jobId), "combined", stageNumber] as const,
  customStages: (jobId: string | undefined) =>
    [...queryKeys.scope("festival-gear", jobId), "custom-stages"] as const,
  maxStages: (jobId: string | undefined) =>
    [...queryKeys.scope("festival-gear", jobId), "max-stages"] as const,
  stages: (jobId: string | undefined) => queryKeys.scope("festival-stages", jobId),
  jobTitle: (jobId: string | undefined) => ["festival-gear-job-title", jobId] as const,
};
