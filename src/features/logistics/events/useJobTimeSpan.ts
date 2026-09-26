import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { MADRID_TIMEZONE, utcToLocalInput } from "@/utils/timezoneUtils";

/** A job's start and end as the logistics dialog edits them: local date keys and HH:mm. */
export type JobTimeSpan = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

/**
 * Converts a job's stored instants to wall-clock values in the job's timezone
 * (Madrid by default). Null when the job has no usable span.
 */
export const jobTimeSpanToLocal = (job: {
  start_time: string | null;
  end_time: string | null;
  timezone?: string | null;
}): JobTimeSpan | null => {
  if (!job.start_time || !job.end_time || job.end_time <= job.start_time) return null;
  const timezone = job.timezone?.trim() || MADRID_TIMEZONE;
  const [startDate, startTime] = utcToLocalInput(job.start_time, timezone).split("T");
  const [endDate, endTime] = utcToLocalInput(job.end_time, timezone).split("T");
  return { startDate, startTime, endDate, endTime };
};

/** The selected job's span, for "Usar las fechas del trabajo" on a transport. */
export function useJobTimeSpan(jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.scope("logistics-job-time-span", jobId ?? ""),
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from("jobs")
        .select("start_time, end_time, timezone")
        .eq("id", jobId ?? "")
        .maybeSingle();
      if (error) throw error;
      return data ? jobTimeSpanToLocal(data) : null;
    },
    enabled: enabled && Boolean(jobId),
    staleTime: 60_000,
  });
}
