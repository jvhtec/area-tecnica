import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Department } from '@/types/department';
import { sanitizeLogData } from '@/lib/enhanced-security-config';
import { OPS_JOB_TYPES_NO_DRYHIRE, OPS_JOB_TYPES_WITH_DRYHIRE } from '@/utils/jobType';
import { useOptimizedRealtime } from '@/hooks/useOptimizedRealtime';
import { createEntityQueryOptions, createQueryKey } from '@/lib/react-query';
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

type JobRow = Database['public']['Tables']['jobs']['Row'];
type TourMeta = { id: string; status: string | null; deleted: boolean | null };

type JobRecord = JobRow & {
  job_departments?: Array<{ department?: Department | null }>;
  job_documents?: Array<Record<string, unknown>>;
  flex_folders?: Array<Record<string, unknown>>;
  tour_meta?: TourMeta | null;
  flex_folders_exist?: boolean;
};

export interface UseJobsDataResult {
  data: JobRecord[];
  jobs: JobRecord[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefreshing: boolean;
  isPaused: boolean;
  realtimeStatus: {
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    retryCount: number;
    retry: () => void;
    stats: unknown;
  };
  refetch: () => Promise<unknown>;
}

const MADRID_TIMEZONE = 'Europe/Madrid';

const normalizeFilterDateToMadridIso = (value?: Date) => {
  if (!value) {
    return null;
  }

  const localWallClock = format(value, "yyyy-MM-dd'T'HH:mm:ss");
  return fromZonedTime(localWallClock, MADRID_TIMEZONE).toISOString();
};

export const normalizeJobsFilters = (filters: JobsDataFilters = {}) => ({
  department: filters.department ?? null,
  startDateIso: normalizeFilterDateToMadridIso(filters.startDate),
  endDateIso: normalizeFilterDateToMadridIso(filters.endDate),
  includeDryhire: filters.includeDryhire ?? true,
});

export const buildJobsDataQueryKey = (filters: JobsDataFilters = {}) =>
  createQueryKey.jobsData.list(normalizeJobsFilters(filters));

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

  const existing = collection.find((job) => job.id === nextRow.id);
  const mergedRow = existing ? ({ ...existing, ...nextRow } as T) : nextRow;
  const withoutExisting = collection.filter((job) => job.id !== nextRow.id);
  return [...withoutExisting, mergedRow];
};

const isJobVisible = (job: JobRecord, tourMetaMap: Record<string, TourMeta>) => {
  if (job.status === 'Cancelado') {
    return false;
  }

  const tourMeta = job.tour_id ? tourMetaMap[job.tour_id] ?? null : null;
  if (tourMeta && (tourMeta.status === 'cancelled' || tourMeta.deleted === true)) {
    return false;
  }

  return true;
};

/**
 * Canonical jobs data hook.
 *
 * Centralizes query key generation, Supabase fetch+filters, and realtime
 * subscription status so all jobs consumers share the same cache namespace.
 */
export const useJobsData = (options: JobsDataOptions = {}): UseJobsDataResult => {
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
  const queryEnabled = enabled && !isPaused;
  const queryKey = useMemo<QueryKey>(
    () => buildJobsDataQueryKey({ department, startDate, endDate, includeDryhire }),
    [department, startDate, endDate, includeDryhire]
  );

  const fetchJobsData = useCallback(async (): Promise<JobRecord[]> => {
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

    if (normalizedFilters.startDateIso) {
      query = query.gte('end_time', normalizedFilters.startDateIso);
    }

    if (normalizedFilters.endDateIso) {
      query = query.lte('start_time', normalizedFilters.endDateIso);
    }

    const { data, error } = await query;

    if (error) {
      console.error('useJobsData: Error fetching jobs', sanitizeLogData(error));
      throw error;
    }

    const jobs = ((data ?? []) as JobRecord[]).map((job) => ({
      ...job,
      job_documents: job.job_documents ?? [],
      flex_folders_exist: (job.flex_folders?.length || 0) > 0,
    }));

    const tourIds = Array.from(new Set(jobs.map((job) => job.tour_id).filter((id): id is string => Boolean(id))));
    const tourMetaMap: Record<string, TourMeta> = {};

    if (tourIds.length > 0) {
      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select('id, status, deleted')
        .in('id', tourIds);

      if (toursError) {
        console.warn('useJobsData: Failed loading tour metadata', sanitizeLogData(toursError));
      } else {
        (toursData ?? []).forEach((tour) => {
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
  }, [department, includeDryhire, normalizedFilters]);

  const jobsQuery = useQuery(
    createEntityQueryOptions<JobRecord[]>('jobsData', {
      queryKey,
      queryFn: fetchJobsData,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      enabled: queryEnabled,
      placeholderData: (previousData) => previousData,
    })
  );

  const jobsRealtimeStatus = useOptimizedRealtime('jobs', queryKey, {
    enabled: realtime && queryEnabled,
    priority: 'high',
  });

  const jobAssignmentsRealtimeStatus = useOptimizedRealtime('job_assignments', queryKey, {
    enabled: realtime && queryEnabled,
    priority: 'high',
  });

  const jobDepartmentsRealtimeStatus = useOptimizedRealtime('job_departments', queryKey, {
    enabled: realtime && queryEnabled,
    priority: 'high',
  });

  const profilesRealtimeStatus = useOptimizedRealtime('profiles', queryKey, {
    enabled: realtime && queryEnabled,
    priority: 'medium',
  });

  const timesheetsRealtimeStatus = useOptimizedRealtime('timesheets', queryKey, {
    enabled: realtime && queryEnabled,
    priority: 'high',
  });

  useEffect(() => {
    if (!realtime || !queryEnabled) {
      return;
    }

    // Ensure cache always stays hydrated/enriched from fetchJobsData.
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryEnabled, queryKey, realtime]);

  const realtimeStatus = useMemo(
    () => ({
      isConnected:
        jobsRealtimeStatus.isConnected &&
        jobAssignmentsRealtimeStatus.isConnected &&
        jobDepartmentsRealtimeStatus.isConnected &&
        profilesRealtimeStatus.isConnected &&
        timesheetsRealtimeStatus.isConnected,
      isLoading:
        jobsRealtimeStatus.isLoading ||
        jobAssignmentsRealtimeStatus.isLoading ||
        jobDepartmentsRealtimeStatus.isLoading ||
        profilesRealtimeStatus.isLoading ||
        timesheetsRealtimeStatus.isLoading,
      error:
        jobsRealtimeStatus.error ||
        jobAssignmentsRealtimeStatus.error ||
        jobDepartmentsRealtimeStatus.error ||
        profilesRealtimeStatus.error ||
        timesheetsRealtimeStatus.error,
      retryCount:
        jobsRealtimeStatus.retryCount +
        jobAssignmentsRealtimeStatus.retryCount +
        jobDepartmentsRealtimeStatus.retryCount +
        profilesRealtimeStatus.retryCount +
        timesheetsRealtimeStatus.retryCount,
      retry: () => {
        jobsRealtimeStatus.retry();
        jobAssignmentsRealtimeStatus.retry();
        jobDepartmentsRealtimeStatus.retry();
        profilesRealtimeStatus.retry();
        timesheetsRealtimeStatus.retry();
      },
      stats: {
        jobs: jobsRealtimeStatus.stats,
        jobAssignments: jobAssignmentsRealtimeStatus.stats,
        jobDepartments: jobDepartmentsRealtimeStatus.stats,
        profiles: profilesRealtimeStatus.stats,
        timesheets: timesheetsRealtimeStatus.stats,
      },
    }),
    [
      jobsRealtimeStatus,
      jobAssignmentsRealtimeStatus,
      jobDepartmentsRealtimeStatus,
      profilesRealtimeStatus,
      timesheetsRealtimeStatus,
    ]
  );

  useEffect(() => {
    if (realtimeStatus.error && !jobsQuery.isLoading && realtime) {
      toast.warning('Real-time updates experiencing issues', {
        description: 'Data will still update, but may be slightly delayed.',
        duration: 3000,
      });
    }
  }, [jobsQuery.isLoading, realtime, realtimeStatus.error]);

  const manualRefetch = useCallback(async () => {
    setIsPaused(false);
    return jobsQuery.refetch();
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
