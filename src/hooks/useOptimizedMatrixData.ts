import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMemo } from 'react';
import { format, isWithinInterval, isSameDay } from 'date-fns';

// Define the specific job type that matches what's passed from JobAssignmentMatrix
interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
  job_type: string;
}

// Define the assignment type with proper job structure
interface AssignmentWithJob {
  job_id: string;
  technician_id: string;
  sound_role?: string;
  lights_role?: string;
  video_role?: string;
  status: string;
  assigned_at: string;
  job: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
  };
}

interface OptimizedMatrixDataProps {
  technicians: Array<{ id: string; first_name: string; last_name: string; email: string; department: string; role: string; }>;
  dates: Date[];
  jobs: MatrixJob[];
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

  // Optimized assignments query with selective fields - exclude declined assignments
  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['optimized-matrix-assignments', jobIds],
    queryFn: async (): Promise<AssignmentWithJob[]> => {
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
          jobs!job_id (
            id,
            title,
            start_time,
            end_time,
            color
          )
        `)
        .in('job_id', jobIds)
        .neq('status', 'declined'); // Filter out declined assignments

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedData = (data || []).map(item => ({
        job_id: item.job_id,
        technician_id: item.technician_id,
        sound_role: item.sound_role,
        lights_role: item.lights_role,
        video_role: item.video_role,
        status: item.status,
        assigned_at: item.assigned_at,
        job: Array.isArray(item.jobs) ? item.jobs[0] : item.jobs
      })).filter(item => item.job); // Filter out items without job data
      
      return transformedData as AssignmentWithJob[];
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
      if (!assignment.job) return;
      
      // assignment.job is a single job object from the inner join
      const jobStart = new Date(assignment.job.start_time);
      const jobEnd = new Date(assignment.job.end_time);
      
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
    const jobsByDate = new Map<string, MatrixJob[]>();
    
    dates.forEach(date => {
      const dateJobs = jobs.filter((job: MatrixJob) => {
        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);
        
        return isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
               isSameDay(date, jobStart) || 
               isSameDay(date, jobEnd);
      });
      
      jobsByDate.set(format(date, 'yyyy-MM-dd'), dateJobs);
    });
    
    return (date: Date): MatrixJob[] => {
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
