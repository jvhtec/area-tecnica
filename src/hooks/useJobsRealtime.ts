
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMultiTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { useSubscriptionStatus } from "./useSubscriptionStatus";

export const useJobsRealtime = () => {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set up multi-table subscriptions using our enhanced hooks
  useMultiTableSubscription([
    { table: 'jobs', queryKey: 'jobs' },
    { table: 'job_date_types', queryKey: 'jobs' },
    { table: 'job_assignments', queryKey: 'jobs' },
    { table: 'job_departments', queryKey: 'jobs' }
  ]);

  // Monitor subscription status
  const status = useSubscriptionStatus(['jobs', 'job_assignments', 'job_departments', 'job_date_types']);

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
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
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log("Manually refreshing jobs data...");
      await refetch();
      toast.success("Jobs refreshed successfully");
    } catch (err) {
      console.error("Error refreshing jobs data:", err);
      toast.error("Failed to refresh jobs data");
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    jobs,
    isLoading,
    isError,
    error,
    isRefreshing,
    refetch: handleRefresh,
    subscriptionStatus: status
  };
};
