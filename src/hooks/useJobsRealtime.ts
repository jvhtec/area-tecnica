
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
    refetch,
    isRefreshing
  } = useRealtimeQuery(
    ['jobs'],
    async () => {
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
    },
    'jobs' // Primary table to subscribe to
  );
  
  return {
    jobs,
    isLoading,
    isError,
    error,
    refetch,
    isRefreshing,
    subscriptionStatus
  };
}
