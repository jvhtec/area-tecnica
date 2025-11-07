import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import React, { useMemo, useEffect } from 'react';
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
  single_day?: boolean | null;
  assignment_date?: string | null;
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
  technicians: Array<{ id: string; first_name: string; nickname?: string | null; last_name: string; email: string; department: string; role: string; }>;
  dates: Date[];
  jobs: MatrixJob[];
}

export const buildAssignmentDateMap = (
  assignments: AssignmentWithJob[],
  dates: Date[]
) => {
  const map = new Map<string, AssignmentWithJob>();
  const visibleDateKeys = new Set(dates.map(date => format(date, 'yyyy-MM-dd')));

  assignments.forEach((assignment) => {
    if (!assignment.job) return;

    if (assignment.single_day && assignment.assignment_date) {
      if (visibleDateKeys.size === 0 || visibleDateKeys.has(assignment.assignment_date)) {
        map.set(`${assignment.technician_id}-${assignment.assignment_date}`, assignment);
      }
      return;
    }

    const jobStart = new Date(assignment.job.start_time);
    const jobEnd = new Date(assignment.job.end_time);

    dates.forEach(date => {
      if (
        isWithinInterval(date, { start: jobStart, end: jobEnd }) ||
        isSameDay(date, jobStart) ||
        isSameDay(date, jobEnd)
      ) {
        const key = `${assignment.technician_id}-${format(date, 'yyyy-MM-dd')}`;
        map.set(key, assignment);
      }
    });
  });

  return map;
};

export const useOptimizedMatrixData = ({ technicians, dates, jobs }: OptimizedMatrixDataProps) => {
  const queryClient = useQueryClient();
  
  // Memoize job IDs to prevent unnecessary queries
  const jobIds = useMemo(() => jobs.map(job => job.id), [jobs]);
  // Fast lookup of jobs by id (fallback when PostgREST join returns no job)
  const jobsById = useMemo(() => {
    const map = new Map<string, MatrixJob>();
    for (const j of jobs) map.set(j.id, j);
    return map;
  }, [jobs]);
  const technicianIds = useMemo(() => technicians.map(t => t.id), [technicians]);
  const dateRange = useMemo(() => ({
    start: dates[0],
    end: dates[dates.length - 1]
  }), [dates]);

  // Much more optimized assignments query - only fetch what's actually needed
  const { data: allAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['optimized-matrix-assignments', jobIds, technicianIds, format(dateRange.start, 'yyyy-MM-dd')],
    queryFn: async (): Promise<AssignmentWithJob[]> => {
      if (jobIds.length === 0 || technicianIds.length === 0) return [];
      
      console.log('Fetching assignments for', jobIds.length, 'jobs and', technicianIds.length, 'technicians');
      
      // Much smaller batch size for faster queries
      const batchSize = 25;
      const promises = [];
      
      for (let i = 0; i < jobIds.length; i += batchSize) {
        const jobBatch = jobIds.slice(i, i + batchSize);
        
        promises.push(
          supabase
            .from('job_assignments')
            .select(`
              job_id,
              technician_id,
              sound_role,
              lights_role,
              video_role,
              single_day,
              assignment_date,
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
            .in('job_id', jobBatch)
            .in('technician_id', technicianIds)
            .limit(500) // Limit per batch
        );
      }
      
      try {
        const results = await Promise.all(promises);
        const allData = results.flatMap(result => {
          if (result.error) {
            console.error('Assignment query error:', result.error);
            return [];
          }
          return result.data || [];
        });
        
        console.log('Fetched', allData.length, 'assignments');
        
        // Transform and filter the data
        const transformedData = allData.map(item => ({
          job_id: item.job_id,
          technician_id: item.technician_id,
          sound_role: item.sound_role,
          lights_role: item.lights_role,
          video_role: item.video_role,
          single_day: item.single_day,
          assignment_date: item.assignment_date,
          status: item.status,
          assigned_at: item.assigned_at,
          // Prefer the jobs array provided to the hook to avoid losing rows when join is blocked by RLS
          job: jobsById.get(item.job_id) || (Array.isArray(item.jobs) ? item.jobs[0] : item.jobs)
        }))
        // Keep rows even if the join returned no job; a fallback from jobsById will usually satisfy it
        .filter(item => !!item.job);
        
        return transformedData as AssignmentWithJob[];
      } catch (error) {
        console.error('Error fetching assignments:', error);
        return [];
      }
    },
    enabled: jobIds.length > 0 && technicianIds.length > 0 && !!dateRange.start,
    staleTime: 30 * 1000, // 30 seconds - more frequent updates
    gcTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false, // Disable automatic refetch on focus
  });

  // Availability (unavailability) merged from per-day schedules and legacy table
  const { data: availabilityData = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['optimized-matrix-availability', technicianIds, format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (technicianIds.length === 0 || !dateRange.start || !dateRange.end) return [] as Array<{ user_id: string; date: string; status: string; notes?: string }>;

      const batchSize = 100;
      const techBatches: string[][] = [];
      for (let i = 0; i < technicianIds.length; i += batchSize) techBatches.push(technicianIds.slice(i, i + batchSize));

      const endIso = dateRange.end.toISOString();
      const startIso = dateRange.start.toISOString();

      // Build per-day unavailable marks in the visible range
      const perDay: Map<string, { user_id: string; date: string; status: string; notes?: string }> = new Map();
      const startDay = new Date(dateRange.start);
      startDay.setHours(0,0,0,0);
      const endDay = new Date(dateRange.end);
      endDay.setHours(0,0,0,0);

      // 1) Per-day schedules (availability_schedules), includes approved vacations (source='vacation')
      //    We consider any status 'unavailable' regardless of source to cover manual and warehouse blocks too.
      // Include rows sourced from vacations or explicitly marked unavailable.
      // Some historical data may store status='vacation' instead of 'unavailable'.
      for (const batch of techBatches) {
        const { data: schedRows, error: schedErr } = await supabase
          .from('availability_schedules')
          .select('user_id, date, status, notes, source')
          .in('user_id', batch)
          .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
          .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
          .or(`status.eq.unavailable,source.eq.vacation`);
        if (schedErr) throw schedErr;
        (schedRows || []).forEach((row: any) => {
          const key = `${row.user_id}-${row.date}`;
          // If interval already marked the day, keep it; otherwise add schedule mark
          if (!perDay.has(key)) {
            perDay.set(key, { user_id: row.user_id, date: row.date, status: 'unavailable', notes: row.notes || undefined });
          } else {
            // Merge notes if present and not set yet
            const cur = perDay.get(key)!;
            if (!cur.notes && row.notes) perDay.set(key, { ...cur, notes: row.notes });
          }
        });
      }

      // 2) Legacy per-day table (technician_availability) – treat vacation/travel/sick/day_off as unavailable
      try {
        const { data: legacyRows, error: legacyErr } = await supabase
          .from('technician_availability')
          .select('technician_id, date, status')
          .in('technician_id', technicianIds)
          .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
          .lte('date', format(dateRange.end, 'yyyy-MM-dd'))
          .in('status', ['vacation','travel','sick','day_off']);
        if (legacyErr) {
          if (legacyErr.code !== '42P01') throw legacyErr; // ignore missing-table
        }
        (legacyRows || []).forEach((row: any) => {
          const key = `${row.technician_id}-${row.date}`;
          if (!perDay.has(key)) perDay.set(key, { user_id: row.technician_id, date: row.date, status: 'unavailable' });
        });
      } catch (e: any) {
        // Ignore if table not present
        if (e?.code !== '42P01') throw e;
      }

      // 3) Final fallback: read approved vacation_requests directly and mark dates unavailable
      try {
        const vacBatchSize = 100;
        const techBatchesForVac: string[][] = [];
        for (let i = 0; i < technicianIds.length; i += vacBatchSize) techBatchesForVac.push(technicianIds.slice(i, i + vacBatchSize));

        for (const batch of techBatchesForVac) {
          const { data: vacs, error: vacErr } = await supabase
            .from('vacation_requests')
            .select('technician_id, start_date, end_date, status')
            .eq('status', 'approved')
            .in('technician_id', batch)
            .lte('start_date', format(dateRange.end, 'yyyy-MM-dd'))
            .gte('end_date', format(dateRange.start, 'yyyy-MM-dd'));
          if (vacErr) {
            // table may be protected or not present in some envs; ignore non-existence
            if (vacErr.code !== '42P01') throw vacErr;
          }
          (vacs || []).forEach((r: any) => {
            const s = new Date(r.start_date);
            const e = new Date(r.end_date);
            const clampStart = new Date(Math.max(startDay.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()));
            const clampEnd = new Date(Math.min(endDay.getTime(), new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()));
            for (let d = new Date(clampStart); d.getTime() <= clampEnd.getTime(); d.setDate(d.getDate() + 1)) {
              const key = `${r.technician_id}-${format(d, 'yyyy-MM-dd')}`;
              if (!perDay.has(key)) perDay.set(key, { user_id: r.technician_id, date: format(d, 'yyyy-MM-dd'), status: 'unavailable' });
            }
          });
        }
      } catch (e: any) {
        if (e?.code && e.code !== '42P01') throw e;
      }

      return Array.from(perDay.values());
    },
    enabled: technicianIds.length > 0 && !!dateRange.start && !!dateRange.end,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Realtime invalidation for availability changes
  useEffect(() => {
    if (!technicianIds.length) return;
    const ch2 = (supabase as any)
      .channel('rt-availability-schedules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_schedules' }, () => {
        queryClient.invalidateQueries({ queryKey: ['optimized-matrix-availability'] });
      })
      .subscribe();
    const ch3 = (supabase as any)
      .channel('rt-technician-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_availability' }, () => {
        queryClient.invalidateQueries({ queryKey: ['optimized-matrix-availability'] });
      })
      .subscribe();
    const ch4 = (supabase as any)
      .channel('rt-vacation-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['optimized-matrix-availability'] });
      })
      .subscribe();
    return () => {
      try { (supabase as any).removeChannel(ch2); } catch {}
      try { (supabase as any).removeChannel(ch3); } catch {}
      try { (supabase as any).removeChannel(ch4); } catch {}
    };
  }, [queryClient, technicianIds.length]);

  // Preload technician data for dialogs
  const prefetchTechnicianData = async (technicianId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['technician', technicianId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, nickname, last_name, department')
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
    const assignmentMap = buildAssignmentDateMap(allAssignments, dates);
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
    // Update all cached assignment queries to reflect the new status immediately
    queryClient.setQueriesData({ queryKey: ['optimized-matrix-assignments'] }, (old: any) => {
      if (!old) return old;
      try {
        return (old as any[]).map((assignment: any) => {
          if (assignment.technician_id === technicianId && assignment.job_id === jobId) {
            return { ...assignment, status: newStatus, response_time: new Date().toISOString() };
          }
          return assignment;
        });
      } catch {
        return old;
      }
    });
  };

  // Invalidate specific queries for real-time updates
  const invalidateAssignmentQueries = async () => {
    console.log('Invalidating assignment queries...');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['jobs'] }) // Also invalidate jobs to refresh the matrix
    ]);
    console.log('Assignment queries invalidated');
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
