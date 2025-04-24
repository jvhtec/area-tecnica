
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRealtimeSubscription } from "./useRealtimeSubscription";
import { toast } from "sonner";
import { Assignment } from "@/types/assignment";

export function useJobAssignmentsRealtime(jobId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Set up real-time subscription
  useRealtimeSubscription('job_assignments', ['job-assignments', jobId], {
    event: '*',
    schema: 'public',
    filter: `job_id=eq.${jobId}`
  });

  const fetchAssignments = useCallback(async () => {
    console.log("Fetching assignments for job:", jobId);
    
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
      return data as Assignment[];
    } catch (error: any) {
      console.error("Error in fetchAssignments:", error);
      toast.error("Failed to load assignments");
      return [];
    }
  }, [jobId]);

  const { 
    data: assignments = [], 
    isLoading,
    refetch 
  } = useQuery({
    queryKey: ['job-assignments', jobId],
    queryFn: fetchAssignments,
    enabled: !!jobId,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
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
    isRefreshing,
    refetch: handleRefresh
  };
}
