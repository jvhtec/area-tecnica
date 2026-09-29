import { useQuery } from "@tanstack/react-query";

import { useOptimizedRealtime } from "@/hooks/useOptimizedRealtime";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { Job, JobType } from "@/types/job";

const FESTIVAL_JOB_TYPES = ["festival", "ciclo"] as const;
const FESTIVAL_JOBS_PAGE_SIZE = 500;

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
  const statusFilter = showCompleted
    ? "status.is.null,status.neq.Cancelado"
    : "status.is.null,and(status.neq.Cancelado,status.neq.Completado)";
  const rows: Array<{
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    created_at: string | null;
    job_type: string | null;
    status: string | null;
    color: string | null;
  }> = [];

  for (let from = 0; ; from += FESTIVAL_JOBS_PAGE_SIZE) {
    const { data, error } = await dataLayerClient
      .from("jobs")
      .select(
        "id, title, description, start_time, end_time, created_at, job_type, status, color",
      )
      .in("job_type", [...FESTIVAL_JOB_TYPES])
      .or(statusFilter)
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + FESTIVAL_JOBS_PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < FESTIVAL_JOBS_PAGE_SIZE) break;
  }

  return rows.flatMap((row) => {
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
