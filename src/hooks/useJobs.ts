
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client"; // Updated import path
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

interface UseJobsParams {
  startDate?: Date;
  endDate?: Date;
}

export const useJobs = (params?: UseJobsParams) => {
  const queryClient = useQueryClient();
  const { startDate, endDate } = params || {};

  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: 'jobs' },
    { table: 'job_date_types', queryKey: 'jobs' },
    { table: 'job_assignments', queryKey: 'jobs' }
  ]);

  return useQuery({
    queryKey: ["jobs", startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      console.log("Fetching jobs...", { startDate, endDate });
      
      // Add retry logic
      const fetchWithRetry = async (retries = 3) => {
        try {
          let query = supabase
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

          // Apply date filters if provided
          if (startDate) {
            query = query.gte('start_time', startDate.toISOString());
          }
          
          if (endDate) {
            query = query.lte('start_time', endDate.toISOString());
          }

          const { data: jobs, error } = await query;

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
  });
};
