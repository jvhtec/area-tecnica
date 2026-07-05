import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useJobSelection } from "@/hooks/useJobSelection";
import { useSelectedTechnicalStage } from "@/features/technical-tools/stage/stageAllocation";

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

  const selectedJob = jobs?.find((job) => job.id === selectedJobId) ?? null;

  return {
    jobs,
    isLoadingJobs,
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
