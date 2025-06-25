
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';
import { format, isWithinInterval, isSameDay } from 'date-fns';
import { Job } from '@/types/job';

interface OptimizedMatrixDataProps {
  technicians: Array<{ id: string; first_name: string; last_name: string; email: string; department: string; role: string; }>;
  dates: Date[];
  jobs: Job[];
}

export const useOptimizedMatrixData = ({ technicians, dates, jobs }: OptimizedMatrixDataProps) => {
  const queryClient = useQueryClient();
  
  // Memoize job IDs to prevent unnecessary queries
  const jobIds = useMemo(() => jobs.map(job => job.id), [jobs]);
  const technicianIds = useMemo(() => technicians.map(t => t.id), [technicians]);
  const dateRange = useMemo(() => ({
    start: dates[0],
    end: dates[dates.length - 1]
  }), [dates]);

  // Optimized assignments query with selective fields
  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['optimized-matrix-assignments', jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          job_id,
          technician_id,
          sound_role,
          lights_role,
          video_role,
          status,
          assigned_at,
          jobs!inner (
            id,
            title,
            start_time,
            end_time,
            color
          )
        `)
        .in('job_id', jobIds);

      if (error) throw error;
      return data || [];
    },
    enabled: jobIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds for faster updates
    gcTime: 2 * 60 * 1000, // 2 minutes cache
  });

  // Optimized availability query with date filtering
  const { data: availabilityData = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['optimized-matrix-availability', technicianIds, format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (technicianIds.length === 0 || !dateRange.start || !dateRange.end) return [];
      
      const { data, error } = await supabase
        .from('availability_schedules')
        .select('user_id, date, status, reason, notes')
        .in('user_id', technicianIds)
        .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.end, 'yyyy-MM-dd'));

      if (error) throw error;
      return data || [];
    },
    enabled: technicianIds.length > 0 && !!dateRange.start && !!dateRange.end,
    staleTime: 30 * 1000, // 30 seconds for faster updates
    gcTime: 2 * 60 * 1000, // 2 minutes cache
  });

  // Preload technician data for dialogs
  const prefetchTechnicianData = async (technicianId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['technician', technicianId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, department')
          .eq('id', technicianId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  // Memoized helper functions
  const getAssignmentForCell = useMemo(() => {
    const assignmentMap = new Map();
    
    allAssignments.forEach(assignment => {
      if (!assignment.jobs) return;
      
      const jobStart = new Date(assignment.jobs.start_time);
      const jobEnd = new Date(assignment.jobs.end_time);
      
      dates.forEach(date => {
        if (isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
            isSameDay(date, jobStart) || 
            isSameDay(date, jobEnd)) {
          const key = `${assignment.technician_id}-${format(date, 'yyyy-MM-dd')}`;
          assignmentMap.set(key, assignment);
        }
      });
    });
    
    return (technicianId: string, date: Date) => {
      const key = `${technicianId}-${format(date, 'yyyy-MM-dd')}`;
      return assignmentMap.get(key);
    };
  }, [allAssignments, dates]);

  const getAvailabilityForCell = useMemo(() => {
    const availabilityMap = new Map();
    
    availabilityData.forEach(availability => {
      const key = `${availability.user_id}-${availability.date}`;
      availabilityMap.set(key, availability);
    });
    
    return (technicianId: string, date: Date) => {
      const key = `${technicianId}-${format(date, 'yyyy-MM-dd')}`;
      return availabilityMap.get(key);
    };
  }, [availabilityData]);

  // Fixed getJobsForDate function with proper typing
  const getJobsForDate = useMemo(() => {
    const jobsByDate = new Map();
    
    dates.forEach(date => {
      const dateJobs = jobs.filter((job: Job) => {
        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);
        
        return isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
               isSameDay(date, jobStart) || 
               isSameDay(date, jobEnd);
      });
      
      jobsByDate.set(format(date, 'yyyy-MM-dd'), dateJobs);
    });
    
    return (date: Date) => {
      return jobsByDate.get(format(date, 'yyyy-MM-dd')) || [];
    };
  }, [jobs, dates]);

  // Optimistic update functions
  const updateAssignmentOptimistically = (technicianId: string, jobId: string, newStatus: string) => {
    const queryKey = ['optimized-matrix-assignments', jobIds];
    const oldData = queryClient.getQueryData(queryKey);
    
    if (oldData) {
      const updatedData = (oldData as any[]).map(assignment => {
        if (assignment.technician_id === technicianId && assignment.job_id === jobId) {
          return { ...assignment, status: newStatus, response_time: new Date().toISOString() };
        }
        return assignment;
      });
      
      queryClient.setQueryData(queryKey, updatedData);
    }
  };

  // Invalidate specific queries for real-time updates
  const invalidateAssignmentQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] })
    ]);
  };

  return {
    allAssignments,
    availabilityData,
    isLoading: assignmentsLoading || availabilityLoading,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    invalidateAssignmentQueries,
  };
};
