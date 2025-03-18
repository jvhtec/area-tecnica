
import { useState, useCallback } from "react";
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

  const fetchJobs = useCallback(async (retries = 3, delay = 1000) => {
    try {
      console.log("Fetching jobs with automatic retries...");
      
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

      console.log("Jobs fetched successfully:", jobs?.length || 0, "jobs");
      return jobs || [];
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying fetch jobs... ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, delay)); 
        return fetchJobs(retries - 1, delay * 2); // Exponential backoff
      }
      throw error;
    }
  }, []);

  const { data: jobs = [], isLoading, isError, error } = useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchInterval: status.isSubscribed ? undefined : 60000, // Poll every minute if subscription is not active
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log("Manually refreshing jobs data...");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
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
