import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import React, { useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

import {
  buildMatrixCellKey,
  chunkArray,
  formatMatrixDateKey,
  invalidateMatrixAssignmentQueries,
  invalidateMatrixAvailabilityQueries,
  matrixDebug,
  matrixQueryKeys,
} from '@/components/matrix/optimized-assignment-matrix/matrixCore';
import type {
  MatrixAvailability,
  MatrixJob,
  MatrixTechnician,
  MatrixTimesheetAssignment,
} from '@/components/matrix/optimized-assignment-matrix/types';
import { useMemoizedMatrix } from './useMemoizedMatrix';

interface OptimizedMatrixDataProps {
  technicians: MatrixTechnician[];
  dates: Date[];
  jobs: MatrixJob[];
}

export const buildAssignmentDateMap = (
  assignments: MatrixTimesheetAssignment[]
) => {
  const map = new Map<string, MatrixTimesheetAssignment>();

  assignments.forEach((assignment) => {
    if (!assignment.job || !assignment.date) return;
    const key = buildMatrixCellKey(assignment.technician_id, assignment.date);
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

interface AvailabilityScheduleRow {
  user_id: string;
  date: string;
  status: string;
  notes?: string | null;
  source?: string | null;
}

interface LegacyAvailabilityRow {
  technician_id: string;
  date: string;
  status: string;
}

interface VacationRequestRow {
  technician_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface MatrixHookError {
  code?: string;
  message?: string;
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
  const promises: Array<Promise<{ data: unknown[] | null; error: { message?: string } | null }>> = [];

  for (const jobBatch of chunkArray(jobIds, batchSize)) {
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
  const staffingPromise = supabase.rpc('get_job_staffing_summary', { p_job_ids: jobIds });

  // Batch job_assignments query to avoid URL length limits
  const assignmentBatchSize = 100;
  const assignmentPromises: Array<Promise<{ data: unknown[] | null; error: { message?: string } | null }>> = [];

  for (const jobBatch of chunkArray(jobIds, assignmentBatchSize)) {
    assignmentPromises.push(
      supabase
        .from('job_assignments')
        // NOTE: single_day and assignment_date are deprecated after simplification migration
        // They're kept in the query for backwards compatibility but should eventually be removed
        .select('job_id, technician_id, sound_role, lights_role, video_role, single_day, assignment_date, status, assigned_at, assigned_by')
        .in('job_id', jobBatch)
        .in('technician_id', technicianIds)
    );
  }

  const [timesheetResults, staffingResult, ...assignmentResults] = await Promise.all([
    Promise.all(promises),
    staffingPromise,
    ...assignmentPromises,
  ]);

  const assignmentMap = new Map<string, MatrixTimesheetAssignment>();
  // Process all assignment batch results
  for (const result of assignmentResults) {
    if (result.error) {
      matrixDebug('Assignment metadata query error', result.error);
    } else {
      (result.data || []).forEach((row) => {
        const assignmentRow = row as MatrixTimesheetAssignment;
        assignmentMap.set(`${assignmentRow.job_id}:${assignmentRow.technician_id}`, assignmentRow);
      });
    }
  }

  const staffingMap = new Map<string, { assigned_count: number; worked_count: number; total_cost_eur: number; approved_cost_eur: number }>();
  if (staffingResult.error) {
    matrixDebug('Staffing summary view error', staffingResult.error);
  } else {
    (staffingResult.data || []).forEach((row: { job_id: string; assigned_count?: number | null; worked_count?: number | null; total_cost_eur?: number | null; approved_cost_eur?: number | null }) => {
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
      matrixDebug('Timesheet query error', result.error);
      return;
    }

    (result.data || []).forEach((row) => {
      const timesheetRow = row as { job_id: string; technician_id: string; date: string; is_schedule_only?: boolean | null; source?: string | null };
      const job = jobsById.get(row.job_id);
      if (!job) return;
      const meta = assignmentMap.get(`${timesheetRow.job_id}:${timesheetRow.technician_id}`);
      const staffing = staffingMap.get(timesheetRow.job_id);
      rows.push({
        job_id: timesheetRow.job_id,
        technician_id: timesheetRow.technician_id,
        date: timesheetRow.date,
        job: {
          ...job,
          assigned_count: staffing?.assigned_count,
          worked_count: staffing?.worked_count,
          total_cost_eur: staffing?.total_cost_eur,
          approved_cost_eur: staffing?.approved_cost_eur,
        } as MatrixJob,
        status: meta?.status ?? null,
        assigned_at: meta?.assigned_at ?? null,
        assigned_by: meta?.assigned_by ?? null,
        single_day: meta?.single_day ?? Boolean(meta?.assignment_date),
        assignment_date: meta?.assignment_date ?? null,
        sound_role: meta?.sound_role ?? null,
        lights_role: meta?.lights_role ?? null,
        video_role: meta?.video_role ?? null,
        is_schedule_only: timesheetRow.is_schedule_only ?? null,
        source: timesheetRow.source ?? null,
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
  const startDateKey = dateRange.start ? formatMatrixDateKey(dateRange.start) : null;
  const endDateKey = dateRange.end ? formatMatrixDateKey(dateRange.end) : null;
  const technicianBatches = useMemo(() => chunkArray(technicianIds, 100), [technicianIds]);

  // Much more optimized assignments query - only fetch what's actually needed
  const {
    data: allAssignments = [],
    isLoading: assignmentsInitialLoading,
    isFetching: assignmentsFetching,
  } = useQuery({
    queryKey: startDateKey && endDateKey
      ? matrixQueryKeys.assignments(jobIds, technicianIds, startDateKey, endDateKey)
      : matrixQueryKeys.assignments([], [], '', ''),
    queryFn: async (): Promise<MatrixTimesheetAssignment[]> => {
      if (jobIds.length === 0 || technicianIds.length === 0) return [];

      matrixDebug('Fetching matrix timesheet assignments', {
        jobs: jobIds.length,
        technicians: technicianIds.length,
      });

      try {
        return await fetchMatrixTimesheetAssignments({
          jobIds,
          technicianIds,
          jobsById,
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
      } catch (error) {
        matrixDebug('Error fetching timesheet assignments', error);
        return [];
      }
    },
    enabled: jobIds.length > 0 && technicianIds.length > 0 && !!startDateKey && !!endDateKey,
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
    queryKey: startDateKey && endDateKey
      ? matrixQueryKeys.availability(technicianIds, startDateKey, endDateKey)
      : matrixQueryKeys.availability([], '', ''),
    queryFn: async (): Promise<MatrixAvailability[]> => {
      if (technicianIds.length === 0 || !dateRange.start || !dateRange.end) return [] as Array<{ user_id: string; date: string; status: string; notes?: string }>;

      const dateStart = format(dateRange.start, 'yyyy-MM-dd');
      const dateEnd = format(dateRange.end, 'yyyy-MM-dd');

      // Build per-day unavailable marks in the visible range
      const perDay: Map<string, { user_id: string; date: string; status: string; notes?: string }> = new Map();
      const startDay = new Date(dateRange.start);
      startDay.setHours(0,0,0,0);
      const endDay = new Date(dateRange.end);
      endDay.setHours(0,0,0,0);

      const runBatches = async <T,>(
        batches: string[][],
        worker: (batch: string[]) => Promise<T[]>,
        concurrency = 3
      ): Promise<T[]> => {
        if (batches.length === 0) return [];
        const results: T[] = [];
        let nextIndex = 0;

        const workers = Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
          while (nextIndex < batches.length) {
            const batchIndex = nextIndex++;
            const batch = batches[batchIndex];
            const rows = await worker(batch);
            results.push(...rows);
          }
        });

        await Promise.all(workers);
        return results;
      };

      // 1) Per-day schedules (availability_schedules), includes approved vacations (source='vacation')
      //    We consider any status 'unavailable' regardless of source to cover manual and warehouse blocks too.
      // Include rows sourced from vacations or explicitly marked unavailable.
      // Some historical data may store status='vacation' instead of 'unavailable'.
      const schedRows = await runBatches(
        technicianBatches,
        async (batch) => {
          const { data, error } = await supabase
            .from('availability_schedules')
            .select('user_id, date, status, notes, source')
            .in('user_id', batch)
            .gte('date', dateStart)
            .lte('date', dateEnd)
            .or(`status.eq.unavailable,source.eq.vacation`);
          if (error) throw error;
          return (data || []) as AvailabilityScheduleRow[];
        },
        3
      );

      schedRows.forEach((row) => {
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

      // 2) Legacy per-day table (technician_availability) – treat vacation/travel/sick/day_off as unavailable
      try {
        const legacyRows = await runBatches(
          technicianBatches,
          async (batch) => {
            const { data, error } = await supabase
              .from('technician_availability')
              .select('technician_id, date, status')
              .in('technician_id', batch)
              .gte('date', dateStart)
              .lte('date', dateEnd)
              .in('status', ['vacation','travel','sick','day_off']);
            if (error) throw error;
            return (data || []) as LegacyAvailabilityRow[];
          },
          3
        );

        legacyRows.forEach((row) => {
          const key = `${row.technician_id}-${row.date}`;
          if (!perDay.has(key)) perDay.set(key, { user_id: row.technician_id, date: row.date, status: 'unavailable' });
        });
      } catch (e: unknown) {
        // Ignore if table not present
        const error = e as MatrixHookError;
        if (error.code !== '42P01') throw e;
      }

      // 3) Final fallback: read approved vacation_requests directly and mark dates unavailable
      try {
        const vacs = await runBatches(
          technicianBatches,
          async (batch) => {
            const { data, error } = await supabase
              .from('vacation_requests')
              .select('technician_id, start_date, end_date, status')
              .eq('status', 'approved')
              .in('technician_id', batch)
              .lte('start_date', dateEnd)
              .gte('end_date', dateStart);
            if (error) throw error;
            return (data || []) as VacationRequestRow[];
          },
          3
        );

        vacs.forEach((r) => {
          const s = new Date(r.start_date);
          const e = new Date(r.end_date);
          const clampStart = new Date(Math.max(startDay.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()));
          const clampEnd = new Date(Math.min(endDay.getTime(), new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()));
          for (let d = new Date(clampStart); d.getTime() <= clampEnd.getTime(); d.setDate(d.getDate() + 1)) {
            const dateKey = formatMatrixDateKey(d);
            const key = `${r.technician_id}-${dateKey}`;
            if (!perDay.has(key)) perDay.set(key, { user_id: r.technician_id, date: dateKey, status: 'unavailable' });
          }
        });
      } catch (e: unknown) {
        const error = e as MatrixHookError;
        if (error.code && error.code !== '42P01') throw e;
      }

      return Array.from(perDay.values());
    },
    enabled: technicianIds.length > 0 && !!startDateKey && !!endDateKey,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const {
    getAssignment: getAssignmentForCell,
    getAvailability: getAvailabilityForCell,
    getJobsForDate,
  } = useMemoizedMatrix(allAssignments, availabilityData, jobs, dates);

  // Realtime invalidation for availability changes
  useEffect(() => {
    if (!technicianIds.length) return;
    const ch2 = supabase
      .channel('rt-availability-schedules')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'availability_schedules' }, () => {
        void invalidateMatrixAvailabilityQueries(queryClient);
      })
      .subscribe();
    const ch3 = supabase
      .channel('rt-technician-availability')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'technician_availability' }, () => {
        void invalidateMatrixAvailabilityQueries(queryClient);
      })
      .subscribe();
    const ch4 = supabase
      .channel('rt-vacation-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vacation_requests' }, () => {
        void invalidateMatrixAvailabilityQueries(queryClient);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch2);
      void supabase.removeChannel(ch3);
      void supabase.removeChannel(ch4);
    };
  }, [queryClient, technicianIds.length]);

  // Preload technician data for dialogs
  const prefetchTechnicianData = async (technicianId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['technician', technicianId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, nickname, last_name, department, profile_picture_url')
          .eq('id', technicianId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  };

  // Optimistic update functions
  const updateAssignmentOptimistically = (technicianId: string, jobId: string, newStatus: string) => {
    // Update all cached assignment queries to reflect the new status immediately
    queryClient.setQueriesData({ queryKey: matrixQueryKeys.assignmentsPrefix }, (old: MatrixTimesheetAssignment[] | undefined) => {
      if (!old) return old;
      try {
        return old.map((assignment) => {
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
    await invalidateMatrixAssignmentQueries(queryClient);
  }, [queryClient]);

  // Realtime subscription for job_assignments table
  useEffect(() => {
    const channel = supabase
      .channel('matrix-job-assignments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        () => {
          void invalidateAssignmentQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateAssignmentQueries]);

  // Realtime subscription for per-day timesheets updates
  useEffect(() => {
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
          void invalidateAssignmentQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invalidateAssignmentQueries]);

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
