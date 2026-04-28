
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getAvailableTechnicians } from "@/utils/technicianAvailability";
import { toast } from "sonner";

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
}

interface UseAvailableTechniciansOptions {
  department: string;
  jobId: string;
  jobStartTime: string;
  jobEndTime: string;
  assignmentDate?: string | null;
  enabled?: boolean;
}

export function useAvailableTechnicians({
  department,
  jobId,
  jobStartTime,
  jobEndTime,
  assignmentDate,
  enabled = true
}: UseAvailableTechniciansOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["available-technicians", department, jobId, jobStartTime, jobEndTime, assignmentDate ?? null],
    queryFn: async () => {
      if (!department || !jobId || !jobStartTime || !jobEndTime) {
        return [];
      }

      try {
        const technicians = await getAvailableTechnicians(
          department,
          jobId,
          jobStartTime,
          jobEndTime,
          assignmentDate
        );
        
        console.log(`Found ${technicians.length} available ${department} technicians for job ${jobId}`);
        return technicians as Technician[];
      } catch (error) {
        console.error("Error fetching available technicians:", error);
        throw error;
      }
    },
    enabled: enabled && !!department && !!jobId && !!jobStartTime && !!jobEndTime,
    staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Set up real-time subscription for job assignments
  useEffect(() => {
    if (!enabled || !department || !jobId) {
      return;
    }

    console.log(`Setting up real-time subscription for available technicians (${department}, job: ${jobId})`);

    const queryKey = ["available-technicians", department, jobId, jobStartTime, jobEndTime, assignmentDate ?? null] as const;
    const channel = supabase
      .channel('technician-availability-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_assignments',
        },
        (payload) => {
          console.log('Job assignment inserted, refreshing available technicians:', payload);
          queryClient.invalidateQueries({
            queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'job_assignments',
        },
        (payload) => {
          console.log('Job assignment removed, refreshing available technicians:', payload);
          queryClient.invalidateQueries({
            queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_assignments',
        },
        (payload) => {
          console.log('Job assignment updated, refreshing available technicians:', payload);
          queryClient.invalidateQueries({
            queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          console.log('Current job changed, refreshing available technicians:', payload);
          queryClient.invalidateQueries({
            queryKey,
          });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up technician availability subscription');
      supabase.removeChannel(channel);
    };
  }, [enabled, department, jobId, jobStartTime, jobEndTime, assignmentDate, queryClient]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await query.refetch();
      toast.success("Available technicians refreshed");
    } catch (error) {
      console.error("Error refreshing available technicians:", error);
      toast.error("Failed to refresh available technicians");
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    technicians: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefreshing: isRefreshing || query.isFetching,
    refetch: handleManualRefresh
  };
}
