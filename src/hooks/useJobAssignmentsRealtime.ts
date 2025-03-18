
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { useTableSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

export function useJobAssignmentsRealtime(jobId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use our subscription hook to set up real-time updates
  useTableSubscription("job_assignments", ["job-assignments", jobId]);

  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ["job-assignments", jobId],
    queryFn: async () => {
      console.log("Fetching assignments for job:", jobId);
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

      if (!data) return [];

      console.log("Assignments data:", data);
      return data as unknown as Assignment[];
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 1000 * 60 * 10, // Refresh every 10 minutes
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
