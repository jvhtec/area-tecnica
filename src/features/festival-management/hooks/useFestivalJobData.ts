import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchFestivalJobDetails } from "@/features/festival-management/queries";
import { trackError } from "@/lib/errorTracking";
import { festivalManagementKeys } from "@/features/festival-management/keys";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalJobData = ({ jobId, toast }: { jobId?: string; toast: ToastFn }) => {
  /** Set by an explicit refresh, so its failure is shown even though the page already has data. */
  const surfaceErrorRef = useRef(false);
  const jobDetailsQueryKey = useMemo(() => festivalManagementKeys.jobDetails(jobId ?? "none"), [jobId]);

  const { data, error, errorUpdatedAt, isLoading, refetch } = useQuery({
    queryKey: jobDetailsQueryKey,
    enabled: Boolean(jobId),
    staleTime: 1000 * 60 * 2,
    networkMode: "always", // the queryFn serves the offline snapshot when disconnected
    queryFn: () => {
      if (!jobId) {
        throw new Error("Missing festival job id");
      }

      return fetchFestivalJobDetails(jobId);
    },
  });

  const hasDataRef = useRef(false);
  hasDataRef.current = data !== undefined;

  // A refetch nobody asked for (a realtime change, a focus refetch) must not interrupt someone who
  // already has the page open; a failed first load and a refresh they asked for are reported.
  useEffect(() => {
    if (!error) {
      return;
    }

    void trackError(error, { system: "festivals", operation: "load-festival-details" });
    if (surfaceErrorRef.current || !hasDataRef.current) {
      toast({
        title: "Error",
        description: "Could not load festival details",
        variant: "destructive",
      });
    }
    surfaceErrorRef.current = false;
  }, [error, errorUpdatedAt, toast]);

  const fetchJobDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!jobId) {
        return;
      }

      surfaceErrorRef.current = !(options?.silent ?? false);
      const result = await refetch();
      if (!result.error) {
        surfaceErrorRef.current = false;
      }
    },
    [jobId, refetch],
  );

  return {
    artistCount: data?.artistCount ?? 0,
    festivalStageOptions: data?.festivalStageOptions ?? [],
    fetchJobDetails,
    isLoading: jobId ? isLoading : false,
    job: data?.job ?? null,
    jobDates: data?.jobDates ?? [],
    maxStages: data?.maxStages ?? 1,
    venueData: data?.venueData ?? {},
  };
};
