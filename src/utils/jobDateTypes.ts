export type JobDateTypeForCard = {
  date?: string | null;
  type?: string | null;
  date_type?: string | null;
};

export type JobDateTypeMap = Record<string, JobDateTypeForCard>;

/** Index a job's embedded date-type rows using the key consumed by job cards. */
export function buildJobDateTypeMap(
  jobId: string,
  dateTypes: JobDateTypeForCard[] | null | undefined,
): JobDateTypeMap {
  const result: JobDateTypeMap = {};

  for (const dateType of dateTypes ?? []) {
    if (!dateType?.date) continue;
    result[`${jobId}-${dateType.date}`] = dateType;
  }

  return result;
}
