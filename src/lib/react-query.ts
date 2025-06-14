
import { QueryClient, QueryOptions, DefaultOptions } from "@tanstack/react-query";
import { createOptimizedQueryClient, createQueryKey, optimizedInvalidation } from "@/lib/optimized-react-query";

// Use the optimized query client
export const queryClient = createOptimizedQueryClient();

// Setup function to initialize React Query with optimizations
export const setupReactQuery = () => {
  console.log('Setting up optimized React Query configuration');
  return { queryClient };
};

// Re-export optimized utilities
export { createQueryKey, optimizedInvalidation };

// Factory function to create a new optimized QueryClient
export const createQueryClient = createOptimizedQueryClient;

// Custom hook factory for common entity queries with optimized keys
export const createEntityQueryOptions = <T>(
  entityType: string,
  id: string,
  options?: Partial<QueryOptions<T>>
): QueryOptions<T> => {
  return {
    queryKey: createQueryKey[entityType as keyof typeof createQueryKey]?.detail?.(id) || [entityType, id],
    ...options,
  };
};

// Optimized helper for optimistic updates
export const applyOptimisticUpdate = <T>(
  entityType: string,
  id: string,
  updateFn: (oldData: T) => T
) => {
  const queryKey = createQueryKey[entityType as keyof typeof createQueryKey]?.detail?.(id) || [entityType, id];
  const oldData = queryClient.getQueryData<T>(queryKey);
  
  if (!oldData) return;
  
  queryClient.setQueryData<T>(queryKey, updateFn(oldData));
};

// Optimized helper for invalidating related entities
export const invalidateRelatedQueries = (entities: string[]) => {
  entities.forEach(entity => {
    const key = createQueryKey[entity as keyof typeof createQueryKey]?.all || [entity];
    queryClient.invalidateQueries({ queryKey: key });
  });
};
