import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";

export const useJobAssignmentsRealtime = (jobId: string) => {
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
      staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: false, // Rely on real-time updates instead of polling
    }
  );

  // Additional real-time subscription specifically for this job
  useEffect(() => {
    if (!jobId) return;

    console.log(`Setting up job-specific assignment subscription for job ${jobId}`);

    const channel = supabase
      .channel(`assignments-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log(`Assignment change detected for job ${jobId}:`, payload);
          // Force immediate refresh
          manualRefresh();
        }
      )
      .subscribe();

    return () => {
      console.log(`Cleaning up job assignment subscription for job ${jobId}`);
      supabase.removeChannel(channel);
    };
  }, [jobId, manualRefresh]);

  const { manageFlexCrewAssignment } = useFlexCrewAssignments();

  const removeAssignment = async (technicianId: string) => {
    try {
      setIsRemoving(prev => ({ ...prev, [technicianId]: true }));

      // Get the assignment details before removal for Flex cleanup
      const assignmentToRemove = assignments.find(a => a.technician_id === technicianId);
      
      // Remove from database
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (error) {
        console.error('Error removing assignment:', error);
        toast({
          title: "Error",
          description: "Failed to remove assignment",
          variant: "destructive",
        });
        return;
      }

      // Remove from Flex crew calls if applicable
      if (assignmentToRemove) {
        if (assignmentToRemove.sound_role && assignmentToRemove.sound_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'remove');
        }
        
        if (assignmentToRemove.lights_role && assignmentToRemove.lights_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'remove');
        }
      }

      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
    } catch (error: any) {
      console.error('Error in removeAssignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove assignment",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(prev => ({ ...prev, [technicianId]: false }));
    }
  };

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
    refetch: handleRefresh,
    removeAssignment
  };
}
