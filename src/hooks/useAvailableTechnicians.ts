
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { getAvailableTechnicians } from "@/utils/technicianAvailability";
import { toast } from "sonner";


import { queryKeys } from "@/lib/react-query";
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
  const availableTechniciansQueryKey = queryKeys.scope(
    "available-technicians",
    department,
    jobId,
    jobStartTime,
    jobEndTime,
    assignmentDate ?? null,
  );

  const query = useQuery({
    queryKey: availableTechniciansQueryKey,
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

  useRealtimeSubscription(
    enabled && department && jobId
      ? [
          {
            table: 'job_assignments',
            queryKey: availableTechniciansQueryKey,
            event: '*',
            filter: `job_id=eq.${jobId}`,
          },
          {
            table: 'jobs',
            queryKey: availableTechniciansQueryKey,
            event: '*',
            filter: `id=eq.${jobId}`,
          },
        ]
      : [],
  );

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
