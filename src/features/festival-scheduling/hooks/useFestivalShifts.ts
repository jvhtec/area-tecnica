import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";
import { fetchShiftsForDate } from "../api";
import { festivalShiftKeys } from "../keys";

const NO_SHIFTS: ShiftWithAssignments[] = [];

interface UseFestivalShiftsParams {
  jobId: string;
  selectedDate: string;
}

/**
 * The shifts (with crew) of one festival day, kept live: a change to the festival's shifts or to
 * anyone's shift assignments refreshes the list, so nobody needs a manual refresh.
 */
export function useFestivalShifts({ jobId, selectedDate }: UseFestivalShiftsParams) {
  const queryClient = useQueryClient();
  const jobKey = festivalShiftKeys.job(jobId);

  // The list embeds the crew, so both tables feed the same query. Assignments carry no job id to
  // filter on; they are rare enough that refreshing this day on any of them is cheap.
  useRealtimeSubscription(
    jobId
      ? [
          { table: "festival_shifts", filter: `job_id=eq.${jobId}`, queryKey: jobKey },
          { table: "festival_shift_assignments", queryKey: jobKey },
        ]
      : [],
  );

  const query = useQuery({
    queryKey: festivalShiftKeys.day(jobId, selectedDate),
    queryFn: () => fetchShiftsForDate(jobId, selectedDate),
    enabled: !!jobId && !!selectedDate,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  /** After a write: refresh every day of this festival (and wait for the visible one). */
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: jobKey }),
    [queryClient, jobKey],
  );

  return {
    shifts: query.data ?? NO_SHIFTS,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    retry: query.refetch,
    invalidate,
  };
}
