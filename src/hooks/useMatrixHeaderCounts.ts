import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/react-query";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { formatMadridDateKey } from "@/utils/timezoneUtils";
import type { MatrixJob, MatrixTimesheetAssignment } from "@/hooks/useOptimizedMatrixData";

/**
 * The counts each date header shows, for the whole loaded range at once.
 *
 * Every header used to run its own queries on mount: a confirmed count and a
 * two-to-three-step open-slot aggregation. Scrolling sideways mounts a header
 * per column, so it streamed requests (and re-renders as they landed) for as
 * long as the user scrolled. Now:
 *
 * - confirmed technicians per day come from the timesheet rows the matrix has
 *   already loaded for its cells (the same is_active timesheets, jobs and
 *   technicians the per-header query read), so they cost no request at all;
 * - open slots are fetched once per range as per-job totals, and a day's
 *   numbers are the sum over its jobs — which is exactly how the per-day query
 *   aggregated them.
 */

export interface MatrixOpenSlots {
  required: number;
  assigned: number;
  open: number;
}

export interface DateHeaderCounts {
  confirmed: number;
  openSlots: MatrixOpenSlots | null;
}

interface JobSlotTotals {
  required: number;
  assigned: number;
}

const JOB_BATCH = 50;

type TimesheetRow = { id: string; job_id: string; technician_id: string };
// A view: PostgREST types every column of it as nullable.
type RequiredRow = { job_id: string | null; total_required: number | null };
type AssignmentRow = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
};

/** Required role slots, and slots held by technicians actually scheduled, per job. */
export async function fetchJobSlotTotals(jobIds: string[]): Promise<Map<string, JobSlotTotals>> {
  const totals = new Map<string, JobSlotTotals>();
  for (const jobId of jobIds) totals.set(jobId, { required: 0, assigned: 0 });

  for (let i = 0; i < jobIds.length; i += JOB_BATCH) {
    const batch = jobIds.slice(i, i + JOB_BATCH);
    const [timesheets, required, assignments] = await Promise.all([
      fetchAllPages<TimesheetRow>((from, to) =>
        supabase
          .from("timesheets")
          .select("id, technician_id, job_id")
          .eq("is_active", true)
          .in("job_id", batch)
          .order("id")
          .range(from, to),
      ),
      fetchAllPages<RequiredRow>((from, to) =>
        supabase
          .from("job_required_roles_summary")
          .select("total_required, job_id")
          .in("job_id", batch)
          .order("job_id")
          .range(from, to),
      ),
      fetchAllPages<AssignmentRow>((from, to) =>
        supabase
          .from("job_assignments")
          .select("job_id, technician_id, sound_role, lights_role, video_role")
          .in("job_id", batch)
          .order("job_id")
          .order("technician_id")
          .range(from, to),
      ),
    ]);

    const scheduled = new Set(timesheets.map((row) => `${row.job_id}:${row.technician_id}`));
    required.forEach((row) => {
      if (!row.job_id) return;
      const total = totals.get(row.job_id);
      if (total) total.required += Number(row.total_required || 0);
    });
    // Only roles held by technicians who are actually scheduled (have an
    // active timesheet on the job) count as filled.
    assignments.forEach((row) => {
      if (!scheduled.has(`${row.job_id}:${row.technician_id}`)) return;
      const total = totals.get(row.job_id);
      if (!total) return;
      if (row.sound_role != null) total.assigned += 1;
      if (row.lights_role != null) total.assigned += 1;
      if (row.video_role != null) total.assigned += 1;
    });
  }

  return totals;
}

const EMPTY_COUNTS: DateHeaderCounts = { confirmed: 0, openSlots: null };

interface UseMatrixHeaderCountsArgs {
  dates: Date[];
  jobs: MatrixJob[];
  allAssignments: MatrixTimesheetAssignment[];
  getJobsForDate: (date: Date) => MatrixJob[];
  /** The open-slot figures only render on desktop headers. */
  includeOpenSlots: boolean;
}

export function useMatrixHeaderCounts({
  dates,
  jobs,
  allAssignments,
  getJobsForDate,
  includeOpenSlots,
}: UseMatrixHeaderCountsArgs) {
  const jobIds = useMemo(() => jobs.map((job) => job.id).sort(), [jobs]);

  const { data: slotTotals } = useQuery({
    // Same scope the per-header query used, so invalidateMatrixHeaderCounts
    // keeps refreshing it.
    queryKey: queryKeys.scope("matrix-open-slots", "by-job", jobIds.join(",")),
    queryFn: () => fetchJobSlotTotals(jobIds),
    enabled: includeOpenSlots && jobIds.length > 0,
    // Refreshed by invalidation (realtime and local writes), not by a timer.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });

  const countsByDate = useMemo(() => {
    const byDate = new Map<string, DateHeaderCounts>();
    const confirmedByDate = new Map<string, Set<string>>();
    const jobIdsByDate = new Map<string, Set<string>>();

    dates.forEach((date) => {
      const dateKey = formatMadridDateKey(date);
      jobIdsByDate.set(dateKey, new Set(getJobsForDate(date).map((job) => job.id)));
    });

    allAssignments.forEach((row) => {
      if (!jobIdsByDate.get(row.date)?.has(row.job_id)) return;
      let technicians = confirmedByDate.get(row.date);
      if (!technicians) {
        technicians = new Set<string>();
        confirmedByDate.set(row.date, technicians);
      }
      technicians.add(row.technician_id);
    });

    jobIdsByDate.forEach((dayJobIds, dateKey) => {
      let openSlots: MatrixOpenSlots | null = null;
      if (slotTotals && dayJobIds.size > 0) {
        let required = 0;
        let assigned = 0;
        dayJobIds.forEach((jobId) => {
          const total = slotTotals.get(jobId);
          if (!total) return;
          required += total.required;
          assigned += total.assigned;
        });
        openSlots = { required, assigned, open: Math.max(required - assigned, 0) };
      }
      byDate.set(dateKey, { confirmed: confirmedByDate.get(dateKey)?.size ?? 0, openSlots });
    });

    return byDate;
  }, [allAssignments, dates, getJobsForDate, slotTotals]);

  return useCallback(
    (date: Date): DateHeaderCounts => countsByDate.get(formatMadridDateKey(date)) ?? EMPTY_COUNTS,
    [countsByDate],
  );
}
