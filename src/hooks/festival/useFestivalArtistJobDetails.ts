import { useEffect, useState } from "react";
import { eachDayOfInterval, format, isValid } from "date-fns";

import { supabase } from "@/lib/enhanced-supabase-client";
import { fetchWithOfflineFallback, getOfflineFestivalContext } from "@/lib/offline";

type JobHeaderDetails = {
  title: string;
  startTime: string;
  endTime: string;
  maxStages: number;
};

/**
 * Job header data for the festival artist management page: title, festival
 * dates (with route-date preselection) and max stages. Races the network
 * against the offline snapshot so a weak connection never leaves the page
 * stuck on "Cargando". The fetchers only RETURN data; state is applied once
 * for whichever side wins, so a timed-out online fetch that resolves later
 * cannot overwrite the snapshot's values with mixed context.
 */
export const useFestivalArtistJobDetails = (jobId: string | undefined, routeDate: string) => {
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [maxStages, setMaxStages] = useState(3);

  useEffect(() => {
    const applyJobDateRange = (startTime: string, endTime: string) => {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      if (!isValid(startDate) || !isValid(endDate)) return;
      const dates = eachDayOfInterval({ start: startDate, end: endDate });
      setJobDates(dates);
      const routeDateExists = routeDate
        ? dates.some((festivalDate) => format(festivalDate, "yyyy-MM-dd") === routeDate)
        : false;
      setSelectedDate(routeDateExists ? routeDate : format(dates[0], "yyyy-MM-dd"));
    };

    const readOfflineJobDetails = async (): Promise<JobHeaderDetails | null> => {
      if (!jobId) return null;
      const offlineContext = await getOfflineFestivalContext(jobId);
      const offlineJob = offlineContext?.job;
      if (!offlineJob) return null;

      return {
        title: (offlineJob.title as string) || "",
        startTime: offlineJob.start_time as string,
        endTime: offlineJob.end_time as string,
        maxStages: offlineContext.maxStages || 3,
      };
    };

    const fetchJobDetailsOnline = async (): Promise<JobHeaderDetails> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("title, start_time, end_time")
        .eq("id", jobId)
        .single();
      if (error) throw error;

      // Default to 3 so a job without gear setup (or a gear-query error)
      // resets the previous job's stage count instead of letting it persist
      let maxStagesValue = 3;
      const { data: gearSetups, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("max_stages")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
      } else if (gearSetups && gearSetups.length > 0) {
        maxStagesValue = gearSetups[0].max_stages || 3;
      }

      return { title: data.title, startTime: data.start_time, endTime: data.end_time, maxStages: maxStagesValue };
    };

    let cancelled = false;

    const fetchJobDetails = async () => {
      if (!jobId) return;
      try {
        const result = await fetchWithOfflineFallback({
          online: fetchJobDetailsOnline,
          offline: readOfflineJobDetails,
        });
        if (cancelled) return;

        const details = result.data;
        setJobTitle(details.title);
        applyJobDateRange(details.startTime, details.endTime);
        setMaxStages(details.maxStages);
      } catch (error) {
        console.error("Error fetching job details:", error);
      }
    };
    fetchJobDetails();

    return () => {
      cancelled = true;
    };
    // routeDate is intentionally read at fetch time only: it tracks
    // selectedDate via the URL, and re-running on every date change would
    // refetch the job for nothing. URL -> state sync for later routeDate
    // changes is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Keep selectedDate in sync when ?date= changes for the same job (e.g.
  // browser back/forward), without refetching the job. In-app date picks
  // round-trip through the URL and land here as a no-op.
  useEffect(() => {
    if (!routeDate || jobDates.length === 0) return;
    const routeDateExists = jobDates.some(
      (festivalDate) => format(festivalDate, "yyyy-MM-dd") === routeDate,
    );
    if (routeDateExists) {
      setSelectedDate((current) => (current === routeDate ? current : routeDate));
    }
  }, [routeDate, jobDates]);

  return { jobTitle, jobDates, selectedDate, setSelectedDate, maxStages };
};
