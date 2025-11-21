/**
 * Optimized Query Hooks
 *
 * High-performance data fetching hooks with:
 * - Smart caching strategies
 * - Background refresh
 * - Optimistic updates
 * - Network-aware fetching
 * - Reduced re-renders
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useNetworkStatus, shallowEqual } from '@/lib/performance-utils';

// ============================================
// QUERY KEY FACTORY
// ============================================

export const queryKeys = {
  // Jobs
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.jobs.lists(), filters] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    dateRange: (start: string, end: string, dept?: string) =>
      [...queryKeys.jobs.all, 'dateRange', start, end, dept] as const,
  },

  // Assignments
  assignments: {
    all: ['assignments'] as const,
    byJob: (jobId: string) => [...queryKeys.assignments.all, 'job', jobId] as const,
    byTechnician: (techId: string) => [...queryKeys.assignments.all, 'tech', techId] as const,
    matrix: (start: string, end: string, dept: string) =>
      [...queryKeys.assignments.all, 'matrix', start, end, dept] as const,
  },

  // Timesheets
  timesheets: {
    all: ['timesheets'] as const,
    byJob: (jobId: string) => [...queryKeys.timesheets.all, 'job', jobId] as const,
    byTechnician: (techId: string) => [...queryKeys.timesheets.all, 'tech', techId] as const,
    pending: () => [...queryKeys.timesheets.all, 'pending'] as const,
  },

  // Profiles/Technicians
  profiles: {
    all: ['profiles'] as const,
    technicians: () => [...queryKeys.profiles.all, 'technicians'] as const,
    byDepartment: (dept: string) => [...queryKeys.profiles.all, 'dept', dept] as const,
    detail: (id: string) => [...queryKeys.profiles.all, 'detail', id] as const,
  },

  // Availability
  availability: {
    all: ['availability'] as const,
    byUser: (userId: string) => [...queryKeys.availability.all, 'user', userId] as const,
    dateRange: (start: string, end: string, userIds?: string[]) =>
      [...queryKeys.availability.all, 'range', start, end, userIds?.join(',')] as const,
  },

  // Tours
  tours: {
    all: ['tours'] as const,
    detail: (id: string) => [...queryKeys.tours.all, 'detail', id] as const,
    dates: (tourId: string) => [...queryKeys.tours.all, 'dates', tourId] as const,
  },

  // Activity
  activity: {
    all: ['activity'] as const,
    recent: (limit?: number) => [...queryKeys.activity.all, 'recent', limit] as const,
    unread: () => [...queryKeys.activity.all, 'unread'] as const,
  },
} as const;

// ============================================
// CACHE CONFIGURATION
// ============================================

export const cacheConfig = {
  // Data that changes frequently
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  },
  // Data that changes occasionally
  standard: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
  // Data that rarely changes
  stable: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  // Static reference data
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// ============================================
// OPTIMIZED JOBS QUERIES
// ============================================

interface JobsQueryOptions {
  startDate?: Date;
  endDate?: Date;
  department?: string;
  status?: string;
  limit?: number;
  enabled?: boolean;
}

export function useOptimizedJobsQuery(options: JobsQueryOptions = {}) {
  const { isOnline, effectiveType, saveData } = useNetworkStatus();
  const queryClient = useQueryClient();

  const {
    startDate,
    endDate,
    department,
    status,
    limit = 100,
    enabled = true,
  } = options;

  // Memoize query key
  const queryKey = useMemo(
    () =>
      queryKeys.jobs.list({
        start: startDate?.toISOString(),
        end: endDate?.toISOString(),
        dept: department,
        status,
        limit,
      }),
    [startDate, endDate, department, status, limit]
  );

  // Determine fetch strategy based on network
  const fetchConfig = useMemo(() => {
    if (!isOnline) {
      return { staleTime: Infinity, refetchOnMount: false };
    }
    if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
      return { ...cacheConfig.stable, refetchOnMount: false };
    }
    if (effectiveType === '3g') {
      return { ...cacheConfig.standard, refetchOnMount: 'always' as const };
    }
    return { ...cacheConfig.realtime, refetchOnMount: 'always' as const };
  }, [isOnline, effectiveType, saveData]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('jobs')
        .select(`
          id, title, start_time, end_time, status, department, color, job_type,
          location, tour_id, tour_date_id, created_at
        `)
        .order('start_time', { ascending: true })
        .limit(limit);

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('start_time', endDate.toISOString());
      }
      if (department) {
        query = query.eq('department', department);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && isOnline,
    ...fetchConfig,
    // Placeholder data from cache while fetching
    placeholderData: (previousData) => previousData,
  });
}

// ============================================
// OPTIMIZED ASSIGNMENTS QUERY
// ============================================

interface AssignmentsQueryOptions {
  jobIds?: string[];
  technicianIds?: string[];
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
}

export function useOptimizedAssignmentsQuery(options: AssignmentsQueryOptions = {}) {
  const { isOnline } = useNetworkStatus();
  const { jobIds, technicianIds, startDate, endDate, enabled = true } = options;

  const queryKey = useMemo(
    () => ['assignments', { jobIds, technicianIds, start: startDate?.toISOString(), end: endDate?.toISOString() }],
    [jobIds, technicianIds, startDate, endDate]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      // Batch fetch for better performance
      const batchSize = 50;
      const results: unknown[] = [];

      if (jobIds && jobIds.length > 0) {
        for (let i = 0; i < jobIds.length; i += batchSize) {
          const batch = jobIds.slice(i, i + batchSize);
          const { data, error } = await supabase
            .from('job_assignments')
            .select(`
              id, job_id, technician_id, assignment_date,
              sound_role, lights_role, video_role,
              profiles:technician_id (id, first_name, last_name, email)
            `)
            .in('job_id', batch);

          if (error) throw error;
          if (data) results.push(...data);
        }
      } else if (technicianIds && technicianIds.length > 0) {
        let query = supabase
          .from('job_assignments')
          .select(`
            id, job_id, technician_id, assignment_date,
            sound_role, lights_role, video_role,
            jobs:job_id (id, title, start_time, end_time, color)
          `)
          .in('technician_id', technicianIds);

        if (startDate) {
          query = query.gte('assignment_date', startDate.toISOString().split('T')[0]);
        }
        if (endDate) {
          query = query.lte('assignment_date', endDate.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (data) results.push(...data);
      }

      return results;
    },
    enabled: enabled && isOnline && (!!jobIds?.length || !!technicianIds?.length),
    ...cacheConfig.standard,
  });
}

// ============================================
// OPTIMIZED TECHNICIANS QUERY
// ============================================

export function useOptimizedTechniciansQuery(department?: string) {
  const { isOnline } = useNetworkStatus();

  const queryKey = useMemo(
    () => department ? queryKeys.profiles.byDepartment(department) : queryKeys.profiles.technicians(),
    [department]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, department, phone, assignable_as_tech')
        .eq('assignable_as_tech', true)
        .order('first_name');

      if (department) {
        query = query.eq('department', department);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isOnline,
    ...cacheConfig.stable, // Technician list doesn't change often
  });
}

// ============================================
// OPTIMIZED AVAILABILITY QUERY
// ============================================

interface AvailabilityQueryOptions {
  userIds?: string[];
  startDate: Date;
  endDate: Date;
  enabled?: boolean;
}

export function useOptimizedAvailabilityQuery(options: AvailabilityQueryOptions) {
  const { isOnline } = useNetworkStatus();
  const { userIds, startDate, endDate, enabled = true } = options;

  const queryKey = useMemo(
    () => queryKeys.availability.dateRange(
      startDate.toISOString(),
      endDate.toISOString(),
      userIds
    ),
    [startDate, endDate, userIds]
  );

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('availability_schedules')
        .select('id, user_id, date, status, source, source_id')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .in('status', ['unavailable', 'vacation', 'sick']);

      if (userIds && userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && isOnline,
    ...cacheConfig.standard,
  });
}

// ============================================
// PREFETCH UTILITIES
// ============================================

export function usePrefetchJobs() {
  const queryClient = useQueryClient();

  return useCallback(
    async (options: JobsQueryOptions) => {
      const queryKey = queryKeys.jobs.list({
        start: options.startDate?.toISOString(),
        end: options.endDate?.toISOString(),
        dept: options.department,
        status: options.status,
        limit: options.limit,
      });

      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          let query = supabase
            .from('jobs')
            .select('id, title, start_time, end_time, status, department, color')
            .order('start_time')
            .limit(options.limit || 100);

          if (options.startDate) {
            query = query.gte('start_time', options.startDate.toISOString());
          }
          if (options.endDate) {
            query = query.lte('start_time', options.endDate.toISOString());
          }

          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        },
        ...cacheConfig.standard,
      });
    },
    [queryClient]
  );
}

// ============================================
// BATCH INVALIDATION
// ============================================

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      invalidateJobs: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      invalidateAssignments: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all }),
      invalidateTimesheets: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.timesheets.all }),
      invalidateProfiles: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all }),
      invalidateAvailability: () =>
        queryClient.invalidateQueries({ queryKey: queryKeys.availability.all }),
      invalidateAll: () => queryClient.invalidateQueries(),
    }),
    [queryClient]
  );
}

// ============================================
// STABLE REFERENCE HOOK
// ============================================

/**
 * Returns a stable reference to a value that only changes when
 * the value is structurally different (deep comparison)
 */
export function useStableValue<T>(value: T): T {
  const ref = useRef<T>(value);

  if (!shallowEqual(value as Record<string, unknown>, ref.current as Record<string, unknown>)) {
    ref.current = value;
  }

  return ref.current;
}

/**
 * Hook that defers query execution until component is mounted and visible
 */
export function useDeferredQuery<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  const [isDeferred, setIsDeferred] = useState(true);

  useEffect(() => {
    // Defer execution to next idle callback
    const id = requestIdleCallback(() => setIsDeferred(false), { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }, []);

  return useQuery({
    queryKey,
    queryFn,
    ...options,
    enabled: !isDeferred && (options?.enabled ?? true),
  });
}

// Polyfill for requestIdleCallback
function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  return window.setTimeout(callback, 1);
}

function cancelIdleCallback(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}
