
import { QueryClient, QueryOptions, DefaultOptions } from "@tanstack/react-query";
import { SubscriptionManager } from "@/lib/subscription-manager";

// Advanced query cache configuration
const queryCacheConfig = {
  gcTime: 5 * 60 * 1000, // 5 minutes - how long to keep unused data in cache
};

// Advanced mutation cache configuration
const mutationCacheConfig = {
  gcTime: 5 * 60 * 1000, // 5 minutes
};

// Configure default options with intelligent defaults
const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 1000 * 60 * 2, // 2 minutes - how long before data is considered stale
    retry: 2, // Retry failed queries twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff with max of 30s
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Refetch when component mounts
    refetchOnReconnect: true, // Refetch when network reconnects
  },
  mutations: {
    retry: 1, // Only retry mutations once
    retryDelay: 1000, // Fixed retry delay for mutations
  },
};

// Create a singleton query client with optimized configuration
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
  queryCache: queryCacheConfig,
  mutationCache: mutationCacheConfig,
});

// Setup function to initialize React Query and Subscriptions
export const setupReactQuery = () => {
  // Initialize the subscription manager
  const subscriptionManager = SubscriptionManager.getInstance(queryClient);
  
  // Set up global refetch strategies
  subscriptionManager.setupVisibilityBasedRefetching();
  subscriptionManager.setupNetworkStatusRefetching();
  
  // Set up core tables that most pages need
  subscriptionManager.subscribeToTable('profiles', 'profiles');
  subscriptionManager.subscribeToTable('jobs', 'jobs');
  
  return { queryClient, subscriptionManager };
};

// Factory function to create a new QueryClient with the same defaults
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
    queryCache: queryCacheConfig,
    mutationCache: mutationCacheConfig,
  });
};

// Custom hook factory for common entity queries
export const createEntityQueryOptions = <T>(
  entityType: string,
  id: string,
  options?: Partial<QueryOptions<T>>
): QueryOptions<T> => {
  return {
    queryKey: [entityType, id],
    ...options,
  };
};

// Helper for optimistic updates
export const applyOptimisticUpdate = <T>(
  entityType: string,
  id: string,
  updateFn: (oldData: T) => T
) => {
  // Get the current data
  const oldData = queryClient.getQueryData<T>([entityType, id]);
  
  if (!oldData) return;
  
  // Apply the update optimistically
  queryClient.setQueryData<T>([entityType, id], updateFn(oldData));
};

// Helper for invalidating related entities
export const invalidateRelatedQueries = (entities: string[]) => {
  entities.forEach(entity => {
    queryClient.invalidateQueries({ queryKey: [entity] });
  });
};
