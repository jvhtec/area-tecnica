
import { useRealtimeQuery } from './useRealtimeQuery';
import { supabase } from '@/lib/enhanced-supabase-client';
import { useSubscriptionStatus } from './useSubscriptionStatus';

/**
 * Hook to fetch jobs with real-time updates
 */
export function useJobsRealtime() {
  // Tables we need to monitor for changes
  const requiredTables = ['jobs', 'job_assignments', 'job_departments', 'job_date_types'];
  
  // Use subscription status hook to monitor connection status
  const subscriptionStatus = useSubscriptionStatus(requiredTables);
  
  // Fetch jobs with real-time updates
  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch: reactQueryRefetch,
    isRefreshing,
    manualRefresh
  } = useRealtimeQuery(
    ['jobs'],
    async () => {
      // Add error handling for the supabase query
      try {
        // Fetch the jobs with joined data
        const { data, error } = await supabase
          .from('jobs')
          .select(`
            *,
            job_departments(department),
            job_assignments(technician_id, status)
          `)
          .order('start_time', { ascending: true });
        
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.error("Error fetching jobs:", err);
        throw err;
      }
    },
    'jobs' // Primary table to subscribe to
  );
  
  // Wrap the refetch function to match expected void return type
  const refetch = async () => {
    try {
      await manualRefresh();
    } catch (error) {
      console.error("Error refreshing jobs:", error);
    }
  };
  
  return {
    jobs: jobs || [],  // Ensure we always return an array
    isLoading,
    isError,
    error,
    refetch,
    isRefreshing,
    subscriptionStatus
  };
}
