import { queryKeys } from "@/lib/react-query";

/**
 * Query keys of the festival shift schedule. The scope name is the table name on purpose: the
 * route-level realtime subscriptions invalidate by table, so a `festival_shifts` event reaches
 * every key below.
 */
export const festivalShiftKeys = {
  /** Every festival's shifts. */
  all: () => queryKeys.scope("festival_shifts"),
  /** All days of one festival. */
  job: (jobId: string) => queryKeys.scope("festival_shifts", jobId),
  /** One day of one festival (shifts with their crew). */
  day: (jobId: string, date: string) => queryKeys.scope("festival_shifts", jobId, date),
  /** The people of a festival that can be scheduled, and the external names used before. */
  crew: (jobId: string) => queryKeys.scope("festival_shift_crew", jobId),
  /** That, for every festival. */
  allCrew: () => queryKeys.scope("festival_shift_crew"),
};
