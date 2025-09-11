
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedRealtime } from './useOptimizedRealtime';
import { toast } from 'sonner';

/**
 * Hook to fetch jobs with real-time updates
 */
export function useJobsRealtime() {
  const [retryCount, setRetryCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const maxRetries = 3;
  
  // Fetch jobs with optimized error handling
  const fetchJobs = useCallback(async () => {
    try {
      console.log("Fetching jobs data...");
      
      // Fetch the jobs with joined data - simplified query for performance
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          job_departments(department),
          job_assignments(technician_id, status)
        `)
        .order('start_time', { ascending: true });
      
      if (error) {
        console.error("Error fetching jobs:", error);
        if (error.code === '401') {
          // Authorization error, trigger token refresh
          window.dispatchEvent(new CustomEvent('token-refresh-needed'));
          throw new Error("Authorization error. Refreshing credentials...");
        }
        throw error;
      }

      setRetryCount(0); // Reset retry count on success
      setIsPaused(false);
      return data || [];
    } catch (error) {
      console.error("Error in fetchJobs:", error);
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        throw error;
      } else {
        setIsPaused(true);
        return [];
      }
    }
  }, [retryCount, maxRetries]);
  
  // Use optimized React Query with realtime subscriptions
  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    retry: maxRetries,
    retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 10000),
    enabled: !isPaused,
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced for better performance
    refetchOnWindowFocus: false, // Disable to reduce load
  });
  
  // Set up optimized realtime subscription
  const realtimeStatus = useOptimizedRealtime('jobs', 'jobs', {
    enabled: !isPaused,
    priority: 'high'
  });
  
  // Show toast notifications for connection issues
  useState(() => {
    if (realtimeStatus.error && !isLoading) {
      toast.warning("Real-time updates experiencing issues", {
        description: "Data will still update, but may be slightly delayed.",
        duration: 3000,
      });
    }
  });
  
  // Manual refresh function with simplified error handling
  const manualRefetch = async () => {
    try {
      setIsPaused(false);
      setRetryCount(0);
      await refetch();
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error("Error in manual refresh:", error);
      toast.error("Failed to refresh data");
    }
  };
  
  return {
    jobs,
    isLoading,
    isError,
    error,
    refetch: manualRefetch,
    isRefreshing: isLoading,
    realtimeStatus,
    isPaused,
    retryCount,
    maxRetries
  };
}
