/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import type { JobSelection } from "@/hooks/useJobSelection";
import { dataLayerClient } from "@/services/dataLayerClient";

type Options = { selectedJob: JobSelection | null; isTourContext: boolean; tourId: string | null; tourDateId: string | null };
const MADRID_TIMEZONE = "Europe/Madrid";
const formatMadridDate = (value: string) => formatInTimeZone(new Date(value), MADRID_TIMEZONE, "dd/MM/yyyy");

export const usePesosContext = ({ selectedJob, isTourContext, tourId, tourDateId }: Options) => {
  const navigate = useNavigate();
  const [isJobOverrideMode, setIsJobOverrideMode] = useState(false);
  const [jobTourInfo, setJobTourInfo] = useState<{ tourName: string; date: string; location: string } | null>(null);
  const [tourName, setTourName] = useState("");
  const [tourDateInfo, setTourDateInfo] = useState<{ date: string; location: string } | null>(null);

  const loadJobTourInfo = useCallback(async () => {
    if (!selectedJob?.tour_date_id) return;

    try {
      const { data } = await dataLayerClient.from('tour_dates')
        .select(`
          date,
          tour:tours(name),
          location:locations(name)
        `)
        .eq('id', selectedJob.tour_date_id)
        .single();

      if (data) {
        setJobTourInfo({
          tourName: (data.tour as any)?.name || 'Unknown Tour',
          date: formatMadridDate(data.date),
          location: (data.location as any)?.name || 'Unknown Location'
        });
      }
    } catch (error) {
      console.error('Error loading job tour info:', error);
    }
  }, [selectedJob?.tour_date_id]);

  // Detect job-based override mode
  useEffect(() => {
    if (selectedJob?.tour_date_id && !isTourContext) {
      setIsJobOverrideMode(true);
      void loadJobTourInfo();
    } else {
      setIsJobOverrideMode(false);
      setJobTourInfo(null);
    }
  }, [selectedJob?.tour_date_id, isTourContext, loadJobTourInfo]);

  useEffect(() => {
    const fetchTourInfo = async () => {
      if (tourId) {
        const { data } = await dataLayerClient.from('tours')
          .select('name')
          .eq('id', tourId)
          .single();

        if (data) {
          setTourName(data.name);
        }
      }

      if (tourDateId) {
        const { data } = await dataLayerClient.from('tour_dates')
          .select(`
            date,
            locations (
              name
            )
          `)
          .eq('id', tourDateId)
          .single();

        if (data) {
          setTourDateInfo({
            date: formatMadridDate(data.date),
            location: (data.locations as any)?.name || 'Unknown location'
          });
        }
      }
    };

    fetchTourInfo();
  }, [tourId, tourDateId]);

  const handleBackNavigation = () => {
    if (isTourContext) {
      navigate('/tours');
    } else {
      navigate('/sound');
    }
  };

  return { handleBackNavigation, isJobOverrideMode, jobTourInfo, tourDateInfo, tourName };
};
