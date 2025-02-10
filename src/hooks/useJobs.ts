
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTimezone } from "@/contexts/TimezoneContext";

export const useJobs = () => {
  const { convertToLocal } = useTimezone();

  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      console.log("Fetching jobs...");
      
      // Add retry logic
      const fetchWithRetry = async (retries = 3) => {
        try {
          const { data: jobs, error } = await supabase
            .from("jobs")
            .select(`
              *,
              location:locations(name),
              job_departments!inner(department),
              job_assignments(
                technician_id,
                sound_role,
                lights_role,
                video_role,
                profiles(
                  first_name,
                  last_name
                )
              ),
              job_documents(*),
              tour_date:tour_dates(*)
            `)
            .order("start_time", { ascending: true });

          if (error) {
            console.error("Error fetching jobs:", error);
            throw error;
          }

          // Convert UTC dates to local timezone
          const localJobs = jobs?.map(job => ({
            ...job,
            start_time: convertToLocal(job.start_time),
            end_time: convertToLocal(job.end_time)
          }));

          console.log("Jobs fetched successfully:", localJobs);
          return localJobs;
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchWithRetry(retries - 1);
          }
          throw error;
        }
      };

      return fetchWithRetry();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
};
