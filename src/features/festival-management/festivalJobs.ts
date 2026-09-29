import { useQuery } from "@tanstack/react-query";

import { useOptimizedRealtime } from "@/hooks/useOptimizedRealtime";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Job, JobType } from "@/types/job";

const FESTIVAL_JOB_TYPES = ["festival", "ciclo"] as const;

export const festivalJobKeys = {
  all: () => ["jobs", "festival-list"] as const,
  list: (showCompleted: boolean) =>
    [...festivalJobKeys.all(), showCompleted ? "all" : "active"] as const,
};

const isFestivalJobType = (
  value: string | null,
): value is Extract<JobType, "festival" | "ciclo"> =>
  value === "festival" || value === "ciclo";

/**
 * Fetch only the rows rendered by the Festivals page. This deliberately has no
 * inner joins: a valid festival must not disappear because optional department,
 * assignment, document or timesheet data is absent.
 */
export async function fetchFestivalJobs(
  showCompleted: boolean,
): Promise<Job[]> {
  const query = dataLayerClient
    .from("jobs")
    .select(
      "id, title, description, start_time, end_time, created_at, job_type, status, color",
    )
    .in("job_type", [...FESTIVAL_JOB_TYPES]);

  const { data, error } = await query.order("start_time", { ascending: true });
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (!isFestivalJobType(row.job_type)) return [];
    if (row.status === "Cancelado") return [];
    if (!showCompleted && row.status === "Completado") return [];

    return [
      {
        id: row.id,
        title: row.title,
        description: row.description,
        start_time: row.start_time,
        end_time: row.end_time,
        created_at: row.created_at ?? "",
        job_type: row.job_type,
        status: row.status,
        color: row.color,
      } satisfies Job,
    ];
  });
}

export function useFestivalJobs(showCompleted: boolean) {
  const queryKey = festivalJobKeys.list(showCompleted);
  useOptimizedRealtime("jobs", [...festivalJobKeys.all()], {
    priority: "high",
  });

  return useQuery({
    queryKey,
    queryFn: () => fetchFestivalJobs(showCompleted),
    staleTime: 2 * 60 * 1000,
  });
}
