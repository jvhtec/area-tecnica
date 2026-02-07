
import { QueryClient, DefaultOptions, QueryKey } from "@tanstack/react-query";

// Optimized React Query configuration for real-time data with multi-tab support
const createOptimizedQueryOptions = (isLeader: boolean = true): DefaultOptions => ({
  queries: {
    staleTime: 2 * 60 * 1000, // 2 minutes - reduced from 5 minutes for real-time data
    retry: (failureCount, error: any) => {
      // Don't retry auth errors or 404s
      if (error?.status === 401 || error?.status === 404) {
        return false;
      }
      return failureCount < 2; // Reduced from 3 retries
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 1.5 ** attemptIndex, 10000), // Faster backoff
    refetchOnWindowFocus: isLeader, // Only leader refetches on focus
    refetchOnMount: 'always', // Always refetch on mount for fresh data
    refetchOnReconnect: isLeader, // Only leader refetches on reconnect
    gcTime: 5 * 60 * 1000, // 5 minutes - reduced from 10 minutes
    networkMode: 'online', // Only make requests when online
  },
  mutations: {
    retry: 1,
    retryDelay: 1500, // Reduced from 2000ms
    gcTime: 2 * 60 * 1000, // 2 minutes - reduced from 5 minutes
    networkMode: 'online',
  },
});

// Default options for backwards compatibility
const optimizedQueryOptions = createOptimizedQueryOptions(true);

// Create optimized query client with deduplication and multi-tab support
export const createOptimizedQueryClient = (isLeader: boolean = true) => {
  const queryClientOptions = createOptimizedQueryOptions(isLeader);
  const queryClient = new QueryClient({
    defaultOptions: queryClientOptions,
  });

  // Add query deduplication
  const originalFetchQuery = queryClient.fetchQuery.bind(queryClient);
  const pendingQueries = new Map<string, Promise<any>>();

  queryClient.fetchQuery = function(options: any) {
    const queryKey = JSON.stringify(options.queryKey);
    
    // Check if this query is already pending
    if (pendingQueries.has(queryKey)) {
      console.log(`Deduplicating query: ${queryKey}`);
      return pendingQueries.get(queryKey)!;
    }

    // Start new query and cache the promise
    const queryPromise = originalFetchQuery(options).finally(() => {
      pendingQueries.delete(queryKey);
    });

    pendingQueries.set(queryKey, queryPromise);
    return queryPromise;
  };

  return queryClient;
};

// Update query client options based on tab role
export const updateQueryClientForRole = (queryClient: QueryClient, isLeader: boolean) => {
  const newOptions = createOptimizedQueryOptions(isLeader);
  queryClient.setDefaultOptions(newOptions);
};

// Query key factory for consistent key generation
export const createQueryKey = {
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...createQueryKey.jobs.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...createQueryKey.jobs.lists(), filters] as const,
    details: () => [...createQueryKey.jobs.all, 'detail'] as const,
    detail: (id: string) => [...createQueryKey.jobs.details(), id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    byJob: (jobId: string) => [...createQueryKey.tasks.all, 'job', jobId] as const,
    byDepartment: (dept: string, jobId: string) => [...createQueryKey.tasks.byJob(jobId), dept] as const,
  },
  folders: {
    all: ['folders'] as const,
    existence: (jobId: string) => [...createQueryKey.folders.all, 'existence', jobId] as const,
  },
  assignments: {
    all: ['assignments'] as const,
    byJob: (jobId: string) => [...createQueryKey.assignments.all, 'job', jobId] as const,
  }
};

// Optimized invalidation strategies
export const optimizedInvalidation = {
  // Invalidate related queries efficiently
  invalidateJobRelated: (queryClient: QueryClient, jobId: string) => {
    const invalidations = [
      createQueryKey.jobs.detail(jobId),
      createQueryKey.tasks.byJob(jobId),
      createQueryKey.assignments.byJob(jobId),
      createQueryKey.folders.existence(jobId)
    ];

    invalidations.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  },

  // Batch invalidation for multiple jobs
  batchInvalidateJobs: (queryClient: QueryClient, jobIds: string[]) => {
    // Use a single invalidation call for job lists
    queryClient.invalidateQueries({ queryKey: createQueryKey.jobs.lists() });
    
    // Invalidate specific job details
    jobIds.forEach(jobId => {
      optimizedInvalidation.invalidateJobRelated(queryClient, jobId);
    });
  },

  // Batch invalidation for arbitrary query keys
  invalidateQueryKeys: (queryClient: QueryClient, queryKeys: QueryKey[]) => {
    queryKeys.forEach(queryKey => {
      queryClient.invalidateQueries({ queryKey });
    });
  },
};
