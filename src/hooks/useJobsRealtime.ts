
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedRealtime } from './useOptimizedRealtime';
import { toast } from 'sonner';
import { aggregateJobTimesheets, TimesheetRowWithTechnician } from '@/utils/timesheetAssignments';
import type { AggregatedTimesheetAssignment } from '@/utils/timesheetAssignments';

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
            location:locations(name),
            job_departments!inner(department),
            job_assignments(
              id,
              technician_id,
              sound_role,
              lights_role,
              video_role,
              assignment_source,
              status,
              single_day,
              assignment_date,
              profiles!job_assignments_technician_id_fkey(
                id,
                first_name,
                last_name,
                nickname,
                department
              )
            ),
            job_documents(*),
            tour_date:tour_dates(*)
          `)
      
      if (error) {
        console.error("Error fetching jobs:", error);
        if (error.code === '401') {
          // Authorization error, trigger token refresh
          window.dispatchEvent(new CustomEvent('token-refresh-needed'));
          throw new Error("Authorization error. Refreshing credentials...");
        }
        throw error;
      }

      const jobsWithAssignments = data || [];

      // Build per-day assignment data from timesheets
      const jobIds = jobsWithAssignments.map(job => job.id).filter(Boolean);
      let timesheetAssignments: Record<string, AggregatedTimesheetAssignment[]> = {};

      if (jobIds.length > 0) {
        // Batch job IDs to avoid URL length limits (max ~100 UUIDs per request)
        const BATCH_SIZE = 100;
        const batches: string[][] = [];

        for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
          batches.push(jobIds.slice(i, i + BATCH_SIZE));
        }

        // Execute all batches in parallel for better performance
        const batchPromises = batches.map(batchIds =>
          supabase
            .from('timesheets')
            .select(`
              job_id,
              technician_id,
              date,
              is_schedule_only,
              technician:profiles!fk_timesheets_technician_id(
                id,
                first_name,
                last_name,
                nickname,
                department
              )
            `)
            .eq('is_schedule_only', false)
            .eq('is_active', true)
            .in('job_id', batchIds)
        );

        const batchResults = await Promise.all(batchPromises);

        // Check for errors and collect all rows
        const allTimesheetRows: TimesheetRowWithTechnician[] = [];
        for (const { data: timesheetRows, error: timesheetError } of batchResults) {
          if (timesheetError) {
            console.error('Error fetching timesheet assignments:', timesheetError);
            throw timesheetError;
          }
          if (timesheetRows) {
            allTimesheetRows.push(...(timesheetRows as TimesheetRowWithTechnician[]));
          }
        }

        const assignmentLookup = jobsWithAssignments.reduce<Record<string, any[]>>((acc, job) => {
          acc[job.id] = job.job_assignments || [];
          return acc;
        }, {});

        timesheetAssignments = aggregateJobTimesheets(
          allTimesheetRows,
          assignmentLookup
        );
      }

      const enrichedJobs = jobsWithAssignments.map(job => ({
        ...job,
        timesheet_assignments: timesheetAssignments[job.id] || [],
      }));

      setRetryCount(0); // Reset retry count on success
      setIsPaused(false);
      return enrichedJobs;
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
  const jobsRealtimeStatus = useOptimizedRealtime('jobs', 'jobs', {
    enabled: !isPaused,
    priority: 'high'
  });

  const timesheetsRealtimeStatus = useOptimizedRealtime('timesheets', ['jobs', 'timesheets'], {
    enabled: !isPaused,
    priority: 'high'
  });

  const realtimeStatus = useMemo(() => ({
    isConnected: jobsRealtimeStatus.isConnected && timesheetsRealtimeStatus.isConnected,
    isLoading: jobsRealtimeStatus.isLoading || timesheetsRealtimeStatus.isLoading,
    error: jobsRealtimeStatus.error || timesheetsRealtimeStatus.error,
    retryCount: jobsRealtimeStatus.retryCount + timesheetsRealtimeStatus.retryCount,
    retry: jobsRealtimeStatus.retry,
    stats: jobsRealtimeStatus.stats,
  }), [jobsRealtimeStatus, timesheetsRealtimeStatus]);

  // Show toast notifications for connection issues
  useEffect(() => {
    if (realtimeStatus.error && !isLoading) {
      toast.warning("Real-time updates experiencing issues", {
        description: "Data will still update, but may be slightly delayed.",
        duration: 3000,
      });
    }
  }, [realtimeStatus.error, isLoading]);
  
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
