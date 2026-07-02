import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchFestivalJobDetails } from "@/features/festival-management/queries";
import { queryKeys } from "@/lib/react-query";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalJobData = ({ jobId, toast }: { jobId?: string; toast: ToastFn }) => {
  const silentErrorRef = useRef(false);
  const jobDetailsQueryKey = useMemo(() => queryKeys.scope("festival-job-details", jobId ?? "none"), [jobId]);

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

  useEffect(() => {
    if (!error) {
      return;
    }

    console.error("Error fetching festival details:", error);
    if (!silentErrorRef.current) {
      toast({
        title: "Error",
        description: "Could not load festival details",
        variant: "destructive",
      });
    }
    silentErrorRef.current = false;
  }, [error, errorUpdatedAt, toast]);

  const fetchJobDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!jobId) {
        return;
      }

      silentErrorRef.current = options?.silent ?? false;
      const result = await refetch();
      if (!result.error) {
        silentErrorRef.current = false;
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
