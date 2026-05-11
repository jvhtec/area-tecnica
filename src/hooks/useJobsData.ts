import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Department } from '@/types/department';
import { sanitizeLogData } from '@/lib/enhanced-security-config';
import { OPS_JOB_TYPES_NO_DRYHIRE, OPS_JOB_TYPES_WITH_DRYHIRE } from '@/utils/jobType';
import { useOptimizedRealtime } from './useOptimizedRealtime';
import { toast } from 'sonner';

export type JobsDataFilters = {
  department?: Department;
  startDate?: Date;
  endDate?: Date;
  includeDryhire?: boolean;
};

export type JobsDataOptions = JobsDataFilters & {
  refetchOnMount?: boolean | 'always';
  realtime?: boolean;
  enabled?: boolean;
};

export type JobRealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export const normalizeJobsFilters = (filters: JobsDataFilters = {}) => ({
  department: filters.department ?? null,
  startDateIso: filters.startDate ? filters.startDate.toISOString() : null,
  endDateIso: filters.endDate ? filters.endDate.toISOString() : null,
  includeDryhire: filters.includeDryhire ?? true,
});

export const buildJobsDataQueryKey = (filters: JobsDataFilters = {}) => [
  'jobs-data',
  normalizeJobsFilters(filters),
] as const;

export const mergeRealtimeJobEvent = <T extends { id: string }>(
  previous: T[] | undefined,
  eventType: JobRealtimeEventType,
  payload: { new?: T | null; old?: T | null }
): T[] => {
  const collection = previous ?? [];

  if (eventType === 'DELETE') {
    const oldId = payload.old?.id;
    return oldId ? collection.filter((job) => job.id !== oldId) : collection;
  }

  const nextRow = payload.new;
  if (!nextRow?.id) {
    return collection;
  }

  const withoutExisting = collection.filter((job) => job.id !== nextRow.id);
  return [...withoutExisting, nextRow];
};

const isJobVisible = (job: any, tourMetaMap: Record<string, { id: string; status: string | null; deleted: boolean | null }>) => {
  if (job.status === 'Cancelado') {
    return false;
  }

  const tourMeta = job.tour_id ? tourMetaMap[job.tour_id] ?? null : null;
  if (tourMeta && (tourMeta.status === 'cancelled' || tourMeta.deleted === true)) {
    return false;
  }

  return true;
};

export const useJobsData = (options: JobsDataOptions = {}) => {
  const {
    department,
    startDate,
    endDate,
    includeDryhire = true,
    refetchOnMount,
    realtime = false,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const [isPaused, setIsPaused] = useState(false);
  const normalizedFilters = useMemo(
    () => normalizeJobsFilters({ department, startDate, endDate, includeDryhire }),
    [department, startDate, endDate, includeDryhire]
  );
  const queryKey = useMemo(
    () => buildJobsDataQueryKey({ department, startDate, endDate, includeDryhire }),
    [department, startDate, endDate, includeDryhire]
  );

  const fetchJobsData = useCallback(async () => {
    const startTime = Date.now();
    const debug = import.meta.env.DEV;

    if (debug) {
      console.log('useJobsData: Fetching jobs', sanitizeLogData(normalizedFilters));
    }

    let query = supabase
      .from('jobs')
      .select(`
        *,
        location:locations(
          id,
          name,
          formatted_address,
          latitude,
          longitude
        ),
        job_departments!inner(
          department
        ),
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
          assigned_at,
          profiles!job_assignments_technician_id_fkey(
            id,
            first_name,
            nickname,
            last_name,
            department
          )
        ),
        job_documents(
          id,
          file_name,
          file_path,
          file_type,
          file_size,
          visible_to_tech,
          uploaded_at,
          read_only,
          template_type
        ),
        flex_folders(
          id,
          element_id,
          department,
          folder_type
        )
      `)
      .in('job_type', includeDryhire ? [...OPS_JOB_TYPES_WITH_DRYHIRE] : [...OPS_JOB_TYPES_NO_DRYHIRE])
      .order('start_time', { ascending: true });

    if (department) {
      query = query.eq('job_departments.department', department);
    }

    if (startDate) {
      query = query.gte('end_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('useJobsData: Error fetching jobs', sanitizeLogData(error));
      throw error;
    }

    const jobs = (data || []).map((job) => ({
      ...job,
      job_documents: job.job_documents || [],
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
    }));

    const tourIds = Array.from(new Set(jobs.map((job) => job.tour_id).filter((id): id is string => Boolean(id))));
    const tourMetaMap: Record<string, { id: string; status: string | null; deleted: boolean | null }> = {};

    if (tourIds.length > 0) {
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select('id, status, deleted')
        .in('id', tourIds);

      if (toursError) {
        console.warn('useJobsData: Failed loading tour metadata', sanitizeLogData(toursError));
      } else {
        (toursData || []).forEach((tour) => {
          if (tour?.id) {
            tourMetaMap[tour.id] = {
              id: tour.id,
              status: tour.status ?? null,
              deleted: tour.deleted ?? null,
            };
          }
        });
      }
    }

    const filteredJobs = jobs
      .filter((job) => isJobVisible(job, tourMetaMap))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    if (debug) {
      const duration = Date.now() - startTime;
      console.log(`useJobsData: fetched ${filteredJobs.length} jobs in ${duration}ms`);
    }

    return filteredJobs;
  }, [department, endDate, includeDryhire, normalizedFilters, startDate]);

  const jobsQuery = useQuery({
    queryKey,
    queryFn: fetchJobsData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    enabled: enabled && !isPaused,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!realtime) {
      return;
    }

    const jobsChannel = supabase
      .channel(`jobs-data-${JSON.stringify(queryKey)}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
        const eventType = payload.eventType as JobRealtimeEventType;

        queryClient.setQueryData(queryKey, (current: any[] | undefined) =>
          mergeRealtimeJobEvent(current, eventType, { new: payload.new as any, old: payload.old as any })
        );
      })
      .subscribe();

    const invalidateChannel = supabase
      .channel(`jobs-data-invalidate-${JSON.stringify(queryKey)}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, () => void jobsQuery.refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_departments' }, () => void jobsQuery.refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_documents' }, () => void jobsQuery.refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheets' }, () => void jobsQuery.refetch())
      .subscribe();

    return () => {
      void supabase.removeChannel(jobsChannel);
      void supabase.removeChannel(invalidateChannel);
    };
  }, [jobsQuery, queryClient, queryKey, realtime]);

  const jobsRealtimeStatus = useOptimizedRealtime('jobs', queryKey as unknown as string[], {
    enabled: realtime && !isPaused,
    priority: 'high',
  });

  const timesheetsRealtimeStatus = useOptimizedRealtime('timesheets', [...queryKey, 'timesheets'] as unknown as string[], {
    enabled: realtime && !isPaused,
    priority: 'high',
  });

  const realtimeStatus = useMemo(
    () => ({
      isConnected: jobsRealtimeStatus.isConnected && timesheetsRealtimeStatus.isConnected,
      isLoading: jobsRealtimeStatus.isLoading || timesheetsRealtimeStatus.isLoading,
      error: jobsRealtimeStatus.error || timesheetsRealtimeStatus.error,
      retryCount: jobsRealtimeStatus.retryCount + timesheetsRealtimeStatus.retryCount,
      retry: jobsRealtimeStatus.retry,
      stats: jobsRealtimeStatus.stats,
    }),
    [jobsRealtimeStatus, timesheetsRealtimeStatus]
  );

  useEffect(() => {
    if (realtimeStatus.error && !jobsQuery.isLoading && realtime) {
      toast.warning('Real-time updates experiencing issues', {
        description: 'Data will still update, but may be slightly delayed.',
        duration: 3000,
      });
    }
  }, [jobsQuery.isLoading, realtime, realtimeStatus.error]);

  useEffect(() => {
    if (jobsQuery.isError) {
      setIsPaused(true);
    } else if (jobsQuery.isSuccess) {
      setIsPaused(false);
    }
  }, [jobsQuery.isError, jobsQuery.isSuccess]);

  const manualRefetch = useCallback(async () => {
    setIsPaused(false);
    await jobsQuery.refetch();
  }, [jobsQuery]);

  return {
    ...jobsQuery,
    data: jobsQuery.data ?? [],
    jobs: jobsQuery.data ?? [],
    isRefreshing: jobsQuery.isRefetching,
    refetch: manualRefetch,
    realtimeStatus,
    isPaused,
  };
};
