import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import React, { useMemo, useEffect, useCallback } from 'react';
import { format, isWithinInterval, isSameDay } from 'date-fns';

// Define the specific job type that matches what's passed from JobAssignmentMatrix
export interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string | null;
  status: string;
  job_type: string;
  assigned_count?: number;
  worked_count?: number;
  total_cost_eur?: number;
  approved_cost_eur?: number;
}

// Define the timesheet-backed assignment type with proper job structure
export interface MatrixTimesheetAssignment {
  job_id: string;
  technician_id: string;
  date: string;
  job: MatrixJob;
  status: string | null;
  assigned_at: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  is_schedule_only?: boolean | null;
  source?: string | null;
}

interface OptimizedMatrixDataProps {
  technicians: Array<{ id: string; first_name: string; nickname?: string | null; last_name: string; email: string; department: string; role: string; }>;
  dates: Date[];
  jobs: MatrixJob[];
}

export const buildAssignmentDateMap = (
  assignments: MatrixTimesheetAssignment[],
  _dates: Date[]
) => {
  const map = new Map<string, MatrixTimesheetAssignment>();

  assignments.forEach((assignment) => {
    if (!assignment.job || !assignment.date) return;
    const key = `${assignment.technician_id}-${assignment.date}`;
    map.set(key, assignment);
  });

  return map;
};

interface FetchMatrixTimesheetArgs {
  jobIds: string[];
  technicianIds: string[];
  jobsById: Map<string, MatrixJob>;
  startDate?: Date;
  endDate?: Date;
}

export const fetchMatrixTimesheetAssignments = async ({
  jobIds,
  technicianIds,
  jobsById,
  startDate,
  endDate,
}: FetchMatrixTimesheetArgs): Promise<MatrixTimesheetAssignment[]> => {
  if (!jobIds.length || !technicianIds.length) return [];

  const startIso = startDate ? format(startDate, 'yyyy-MM-dd') : null;
  const endIso = endDate ? format(endDate, 'yyyy-MM-dd') : null;

  const batchSize = 50;
  const promises: Promise<any>[] = [];

  for (let i = 0; i < jobIds.length; i += batchSize) {
    const jobBatch = jobIds.slice(i, i + batchSize);
    let query = supabase
      .from('timesheets')
      .select('job_id, technician_id, date, is_schedule_only, source')
      .eq('is_active', true)
      .in('job_id', jobBatch)
      .in('technician_id', technicianIds)
      .order('date', { ascending: true })
      .limit(2000);

    if (startIso) query = query.gte('date', startIso);
    if (endIso) query = query.lte('date', endIso);

    promises.push(query);
  }

  // Leverage materialized view for staffing status/cost rollups per job
  const staffingPromise = supabase
    .from('v_job_staffing_summary')
    .select('job_id, assigned_count, worked_count, total_cost_eur, approved_cost_eur')
    .in('job_id', jobIds);

  // Batch job_assignments query to avoid URL length limits
  const assignmentBatchSize = 100;
  const assignmentPromises: Promise<any>[] = [];

  for (let i = 0; i < jobIds.length; i += assignmentBatchSize) {
    const jobBatch = jobIds.slice(i, i + assignmentBatchSize);
    assignmentPromises.push(
      supabase
        .from('job_assignments')
        // NOTE: single_day and assignment_date are deprecated after simplification migration
        // They're kept in the query for backwards compatibility but should eventually be removed
        .select('job_id, technician_id, sound_role, lights_role, video_role, single_day, assignment_date, status, assigned_at')
        .in('job_id', jobBatch)
        .in('technician_id', technicianIds)
    );
  }

  const [timesheetResults, staffingResult, ...assignmentResults] = await Promise.all([
    Promise.all(promises),
    staffingPromise,
    ...assignmentPromises,
  ]);

  const assignmentMap = new Map<string, any>();
  // Process all assignment batch results
  for (const result of assignmentResults) {
    if (result.error) {
      console.error('Assignment metadata query error:', result.error);
    } else {
      (result.data || []).forEach((row: any) => {
        assignmentMap.set(`${row.job_id}:${row.technician_id}`, row);
      });
    }
  }

  const staffingMap = new Map<string, { assigned_count: number; worked_count: number; total_cost_eur: number; approved_cost_eur: number }>();
  if (staffingResult.error) {
    console.warn('Staffing summary view error:', staffingResult.error);
  } else {
    (staffingResult.data || []).forEach((row: any) => {
      staffingMap.set(row.job_id, {
        assigned_count: row.assigned_count ?? 0,
        worked_count: row.worked_count ?? 0,
        total_cost_eur: row.total_cost_eur ?? 0,
        approved_cost_eur: row.approved_cost_eur ?? 0,
      });
    });
  }

  const rows: MatrixTimesheetAssignment[] = [];

  timesheetResults.forEach((result) => {
    if (result.error) {
      console.error('Timesheet query error:', result.error);
      return;
    }

    (result.data || []).forEach((row: any) => {
      const job = jobsById.get(row.job_id);
      if (!job) return;
      const meta = assignmentMap.get(`${row.job_id}:${row.technician_id}`);
      const staffing = staffingMap.get(row.job_id);
      rows.push({
        job_id: row.job_id,
        technician_id: row.technician_id,
        date: row.date,
        job: {
          ...job,
          assigned_count: staffing?.assigned_count,
          worked_count: staffing?.worked_count,
          total_cost_eur: staffing?.total_cost_eur,
          approved_cost_eur: staffing?.approved_cost_eur,
        } as MatrixJob,
        status: meta?.status ?? null,
        assigned_at: meta?.assigned_at ?? null,
        single_day: meta?.single_day ?? Boolean(meta?.assignment_date),
        assignment_date: meta?.assignment_date ?? null,
        sound_role: meta?.sound_role ?? null,
        lights_role: meta?.lights_role ?? null,
        video_role: meta?.video_role ?? null,
        is_schedule_only: row.is_schedule_only ?? null,
        source: row.source ?? null,
      });
    });
  });

  return rows;
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
  const {
    data: allAssignments = [],
    isLoading: assignmentsInitialLoading,
    isFetching: assignmentsFetching,
  } = useQuery({
    queryKey: [
      'optimized-matrix-assignments',
      jobIds,
      technicianIds,
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: async (): Promise<MatrixTimesheetAssignment[]> => {
      if (jobIds.length === 0 || technicianIds.length === 0) return [];

      console.log('Fetching timesheet assignments for', jobIds.length, 'jobs and', technicianIds.length, 'technicians');

      try {
        return await fetchMatrixTimesheetAssignments({
          jobIds,
          technicianIds,
          jobsById,
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
      } catch (error) {
        console.error('Error fetching timesheet assignments:', error);
        return [];
      }
    },
    enabled: jobIds.length > 0 && technicianIds.length > 0 && !!dateRange.start && !!dateRange.end,
    staleTime: 30 * 1000, // 30 seconds - more frequent updates
    gcTime: 2 * 60 * 1000, // 2 minutes cache
    refetchOnWindowFocus: false, // Disable automatic refetch on focus
    placeholderData: (previousData) => previousData,
  });

  // Availability (unavailability) merged from per-day schedules and legacy table
  const {
    data: availabilityData = [],
    isLoading: availabilityInitialLoading,
    isFetching: availabilityFetching,
  } = useQuery({
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
    placeholderData: (previousData) => previousData,
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
  const invalidateAssignmentQueries = useCallback(async () => {
    console.log('Invalidating assignment queries...');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['matrix-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['job-assignments'] }),
      queryClient.invalidateQueries({ queryKey: ['jobs'] }) // Also invalidate jobs to refresh the matrix
    ]);
    console.log('Assignment queries invalidated');
  }, [queryClient]);

  // Realtime subscription for job_assignments table
  useEffect(() => {
    console.log('🔔 Setting up job_assignments realtime subscription for matrix');

    const channel = supabase
      .channel('matrix-job-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        (payload) => {
          console.log('🔔 job_assignments change detected in matrix:', payload.eventType, payload);
          // Immediately invalidate and refetch
          invalidateAssignmentQueries();
        }
      )
      .subscribe((status) => {
        console.log('🔔 job_assignments subscription status:', status);
      });

    return () => {
      console.log('🔔 Cleaning up job_assignments realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [invalidateAssignmentQueries]);

  // Realtime subscription for per-day timesheets updates
  useEffect(() => {
    console.log('🔔 Setting up timesheets realtime subscription for matrix');

    const channel = supabase
      .channel('matrix-timesheets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timesheets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] });
        }
      )
      .subscribe((status) => {
        console.log('🔔 timesheets subscription status:', status);
      });

    return () => {
      console.log('🔔 Cleaning up timesheets realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isInitialLoading = assignmentsInitialLoading || availabilityInitialLoading;
  const isFetching = assignmentsFetching || availabilityFetching;

  return {
    allAssignments,
    availabilityData,
    isInitialLoading,
    isFetching,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    invalidateAssignmentQueries,
  };
};
