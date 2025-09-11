
import { useState, useCallback, useEffect } from 'react';
import { useRealtimeQuery } from './useRealtimeQuery';
import { supabase, ensureRealtimeConnection } from '@/lib/supabase';
import { useSubscriptionStatus } from './useSubscriptionStatus';
import { toast } from 'sonner';

/**
 * Hook to fetch jobs with real-time updates
 */
export function useJobsRealtime() {
  const [retryCount, setRetryCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const maxRetries = 3;
  
  // Tables we need to monitor for changes
  const requiredTables = ['jobs', 'job_assignments', 'job_departments', 'job_date_types'];
  
  // Use subscription status hook to monitor connection status
  const subscriptionStatus = useSubscriptionStatus(requiredTables);
  
  // Fetch jobs with enhanced error handling
  const fetchJobs = useCallback(async () => {
    try {
      console.log("Fetching jobs data...");
      
      // Check realtime connection before fetch
      if (await ensureRealtimeConnection()) {
        console.log("Realtime connection established, proceeding with fetch");
      } else {
        console.warn("Realtime connection couldn't be established, proceeding with fetch anyway");
      }
      
      // Fetch the jobs with joined data
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
        // Increment retry count and throw to trigger retry
        setRetryCount(prev => prev + 1);
        throw error;
      } else {
        // Max retries reached, pause fetching
        setIsPaused(true);
        return [];
      }
    }
  }, [retryCount, maxRetries]);
  
  // Use our enhanced real-time query hook
  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch: reactQueryRefetch,
    isRefreshing,
    manualRefresh,
    isSubscribed,
    isStale
  } = useRealtimeQuery(
    ['jobs'],
    fetchJobs,
    'jobs', // Primary table to subscribe to
    {
      retry: maxRetries,
      retryDelay: attemptIndex => Math.min(1000 * (2 ** attemptIndex), 10000),
      enabled: !isPaused,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
  
  // Effect to handle stale data
  useEffect(() => {
    if (isStale && !isLoading && !isError) {
      console.log("Data is stale, refreshing...");
      manualRefresh().catch(err => {
        console.error("Error refreshing stale data:", err);
      });
    }
  }, [isStale, isLoading, isError, manualRefresh]);
  
  // Effect to show toast notifications for subscription status
  useEffect(() => {
    if (!isSubscribed && !isLoading && jobs?.length) {
      toast.warning("Real-time updates are not active. Data might be stale.", {
        description: "We're trying to reconnect. Click refresh to force update.",
        duration: 5000,
      });
    }
  }, [isSubscribed, isLoading, jobs]);
  
  // Manual refresh function with enhanced error handling
  const refetch = async () => {
    try {
      await manualRefresh();
    } catch (error) {
      console.error("Error in manual refresh:", error);
      toast.error("Failed to refresh data. Trying to reconnect...");
      
      // Try to recover the connection
      const recovered = await ensureRealtimeConnection();
      if (recovered) {
        toast.success("Connection restored. Refreshing data...");
        setIsPaused(false);
        setRetryCount(0);
        await manualRefresh();
      }
    }
  };
  
  return {
    jobs,
    isLoading,
    isError,
    error,
    refetch,
    isRefreshing,
    subscriptionStatus,
    isPaused,
    retryCount,
    maxRetries
  };
}
