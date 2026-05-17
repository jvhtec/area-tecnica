import { useCallback, useState } from "react";

import { fetchFestivalJobDetails } from "../queries";
import type { FestivalJob, FestivalStageOption, FestivalVenueData } from "../types";

type ToastFn = (props: { description?: string; title: string; variant?: "destructive" }) => void;

export const useFestivalJobData = ({ jobId, toast }: { jobId?: string; toast: ToastFn }) => {
  const [job, setJob] = useState<FestivalJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [artistCount, setArtistCount] = useState(0);
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [venueData, setVenueData] = useState<FestivalVenueData>({});
  const [maxStages, setMaxStages] = useState(1);
  const [festivalStageOptions, setFestivalStageOptions] = useState<FestivalStageOption[]>([]);

  const fetchJobDetails = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!jobId) {
        setJob(null);
        setArtistCount(0);
        setJobDates([]);
        setVenueData({});
        setFestivalStageOptions([]);
        setMaxStages(1);
        if (!silent) {
          setIsLoading(false);
        }
        return;
      }

      if (!silent) {
        setIsLoading(true);
      }

      try {
        const data = await fetchFestivalJobDetails(jobId);
        setJob(data.job);
        setArtistCount(data.artistCount);
        setJobDates(data.jobDates);
        setVenueData(data.venueData);
        setMaxStages(data.maxStages);
        setFestivalStageOptions(data.festivalStageOptions);
      } catch (error) {
        console.error("Error fetching festival details:", error);
        if (!silent) {
          toast({
            title: "Error",
            description: "Could not load festival details",
            variant: "destructive",
          });
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [jobId, toast],
  );

  return {
    artistCount,
    festivalStageOptions,
    fetchJobDetails,
    isLoading,
    job,
    jobDates,
    maxStages,
    venueData,
  };
};
