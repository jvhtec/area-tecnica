import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useJobSelection, type JobSelection } from "@/hooks/useJobSelection";
import { useSelectedTechnicalStage } from "@/features/technical-tools/stage/stageAllocation";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

/**
 * Job + festival-stage selection shared by the three Memoria Técnica forms
 * (sound/lights/video). Mirrors PesosTool's `?jobId=` query-param convention
 * so the same deep link works whether the form lives in a dialog (sound) or
 * a full-page route (lights/video).
 */
export const useMemoriaJobAndStage = () => {
  const { data: jobs, isLoading: isLoadingJobs } = useJobSelection();
  const [searchParams] = useSearchParams();
  const jobIdFromUrl = searchParams.get("jobId");
  const [selectedJobId, setSelectedJobId] = useState("");

  useEffect(() => {
    if (jobIdFromUrl) {
      setSelectedJobId(jobIdFromUrl);
    }
  }, [jobIdFromUrl]);

  const {
    hasMultipleStages,
    isLoadingStages,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages,
  } = useSelectedTechnicalStage({
    enabled: Boolean(selectedJobId),
    jobId: selectedJobId,
  });

  const selectedJobFromList = jobs?.find((job) => job.id === selectedJobId) ?? null;
  const shouldLoadFallbackJob = Boolean(selectedJobId && !selectedJobFromList && !isLoadingJobs);
  const { data: fallbackJob = null, isLoading: isLoadingFallbackJob } = useQuery<JobSelection | null>({
    queryKey: queryKeys.scope("memoria-selected-job", selectedJobId),
    enabled: shouldLoadFallbackJob,
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from("jobs")
        .select("id, title, start_time, end_time, tour_date_id")
        .eq("id", selectedJobId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        title: data.title,
        start_time: data.start_time,
        end_time: data.end_time,
        tour_date_id: data.tour_date_id,
        tour_date: null,
      };
    },
  });

  const selectedJob = selectedJobFromList ?? fallbackJob;

  return {
    jobs,
    isLoadingJobs: isLoadingJobs || isLoadingFallbackJob,
    jobIdFromUrl,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    hasMultipleStages,
    isLoadingStages,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages,
  };
};
