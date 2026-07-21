
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
        .gte('end_time', today.toISOString()) // Include ongoing jobs; exclude jobs that already ended
        .in('job_type', ['single', 'festival', 'ciclo', 'tourdate']) // Only include relevant job types
        .or('status.is.null,status.in.(Tentativa,Confirmado)') // Exclude completed/cancelled jobs
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching jobs:", error);
        throw error;
      }

      console.log("Raw jobs data:", jobs);

      // Transform the data to match our expected types
      const transformedJobs = jobs?.map(job => ({
        id: job.id,
        title: job.title,
        start_time: job.start_time,
        end_time: job.end_time,
        tour_date_id: job.tour_date_id,
        tour_date: job.tour_date ? {
          id: job.tour_date[0]?.id, // Access first element of tour_date array
          tour: {
            id: job.tour_date[0]?.tour[0]?.id, // Access first tour from the first tour_date
            name: job.tour_date[0]?.tour[0]?.name
          }
        } : null
      })) as JobSelection[];

      console.log("Transformed jobs:", transformedJobs);
      return transformedJobs;
    },
  });
};
