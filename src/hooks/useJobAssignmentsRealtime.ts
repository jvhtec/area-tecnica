
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { useTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";

export function useJobAssignmentsRealtime(jobId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use our enhanced real-time query hook for better reliability
  const { 
    data: assignments = [], 
    isLoading, 
    manualRefresh,
    isRefreshing: isQueryRefreshing
  } = useRealtimeQuery<Assignment[]>(
    ["job-assignments", jobId],
    async () => {
      console.log("Fetching assignments for job:", jobId);
      
      // Add retry logic
      const fetchWithRetry = async (retries = 3) => {
        try {
          const { data, error } = await supabase
            .from("job_assignments")
            .select(`
              *,
              profiles (
                first_name,
                last_name,
                email,
                department
              )
            `)
            .eq("job_id", jobId);

          if (error) {
            console.error("Error fetching assignments:", error);
            throw error;
          }

          console.log(`Successfully fetched ${data?.length || 0} assignments for job ${jobId}`);
          return data as unknown as Assignment[];
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying assignments fetch... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return fetchWithRetry(retries - 1);
          }
          throw error;
        }
      };
      
      return fetchWithRetry();
    },
    "job_assignments",
    {
      staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
    }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await manualRefresh();
      toast.success("Assignments refreshed");
    } catch (error) {
      console.error("Error refreshing assignments:", error);
      toast.error("Failed to refresh assignments");
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    assignments,
    isLoading,
    isRefreshing: isRefreshing || isQueryRefreshing,
    refetch: handleRefresh
  };
}
