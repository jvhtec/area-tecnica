import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useJobs = () => {
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

          console.log("Jobs fetched successfully:", jobs);
          return jobs;
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return fetchWithRetry(retries - 1);
          }
          throw error;
        }
      };

      return fetchWithRetry();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
};