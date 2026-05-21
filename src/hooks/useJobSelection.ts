
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";


import { queryKeys } from "@/lib/react-query";
export interface TourDate {
  id: string;
  tour: {
    id: string;
    name: string;
  };
}

export interface JobSelection {
  id: string;
  title: string;
  tour_date_id: string | null;
  tour_date: TourDate | null;
  start_time: string;
  end_time: string;
}

const oneOrFirst = <T,>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export const useJobSelection = () => {
  return useQuery({
    queryKey: queryKeys.scope("jobs-for-selection"),
    queryFn: async () => {
      console.log("Fetching jobs for selection...");
      
      // Get today's date in ISO format to filter future/present jobs
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day
      
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select(`
          id,
          title,
          start_time,
          end_time,
          tour_date_id,
          job_type,
          status,
          tour_date:tour_dates!tour_date_id (
            id,
            tour:tours (
              id,
              name
            )
          )
        `)
        .gte('end_time', today.toISOString()) // Include ongoing multi-day jobs
        .in('job_type', ['single', 'festival', 'ciclo', 'tourdate']) // Only include relevant job types
        .neq('status', 'Completado') // Exclude completed/deleted jobs
        .neq('status', 'Cancelado')
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }

      console.log("Raw jobs data:", jobs);

      // Transform the data to match our expected types
      const transformedJobs = jobs?.map(job => {
        const tourDate = oneOrFirst(job.tour_date);
        const tour = oneOrFirst(tourDate?.tour);

        return {
          id: job.id,
          title: job.title,
          start_time: job.start_time,
          end_time: job.end_time,
          tour_date_id: job.tour_date_id,
          tour_date: tourDate ? {
            id: tourDate.id,
            tour: {
              id: tour?.id ?? "",
              name: tour?.name ?? ""
            }
          } : null
        };
      }) as JobSelection[];

      console.log("Transformed jobs:", transformedJobs);
      return transformedJobs;
    },
  });
};
