
import { QueryClient, QueryOptions, DefaultOptions, QueryKey } from "@tanstack/react-query";
import { createOptimizedQueryClient, createQueryKey, optimizedInvalidation } from "@/lib/optimized-react-query";

// Use the optimized query client
export const queryClient = createOptimizedQueryClient();

// Setup function to initialize React Query with optimizations
export const setupReactQuery = () => {
  if (import.meta.env.DEV) {
    console.log('Setting up optimized React Query configuration');
  }
  return { queryClient };
};

// Re-export optimized utilities
export { createQueryKey, optimizedInvalidation };

type QueryKeyPart = unknown;

function scopedQueryKey<Scope extends string>(scope: Scope, ...parts: string[]): string[];
function scopedQueryKey(scope: string, ...parts: QueryKeyPart[]): QueryKeyPart[];
function scopedQueryKey(scope: string, ...parts: QueryKeyPart[]): QueryKeyPart[] {
  return [scope, ...parts];
}

function customQueryKey(...parts: string[]): string[];
function customQueryKey(...parts: QueryKeyPart[]): QueryKeyPart[];
function customQueryKey(...parts: QueryKeyPart[]): QueryKeyPart[] {
  return parts;
}

/**
 * Generic query-key factory used while migrating legacy inline keys toward
 * domain-specific factories. It preserves existing key shapes and gives static
 * scans one canonical creation point.
 */
export const queryKeys = {
  scope: scopedQueryKey,
  custom: customQueryKey,
};

// Factory function to create a new optimized QueryClient
export const createQueryClient = createOptimizedQueryClient;

// Custom hook factory for common entity queries with optimized keys
export const createEntityQueryOptions = <T>(
  entityType: string,
  id: string,
  options?: Partial<QueryOptions<T>>
): QueryOptions<T> => {
  const keyGenerator = createQueryKey[entityType as keyof typeof createQueryKey];
  return {
    queryKey: (keyGenerator && 'detail' in keyGenerator)
      ? (keyGenerator as { detail: (id: string) => QueryKey }).detail(id)
      : [entityType, id],
    ...options,
  };
};

// Optimized helper for optimistic updates
export const applyOptimisticUpdate = <T>(
  entityType: string,
  id: string,
  updateFn: (oldData: T) => T
) => {
  const keyGenerator = createQueryKey[entityType as keyof typeof createQueryKey];
  const queryKey = (keyGenerator && 'detail' in keyGenerator)
    ? (keyGenerator as { detail: (id: string) => QueryKey }).detail(id)
    : [entityType, id];
  const oldData = queryClient.getQueryData<T>(queryKey);
  
  if (!oldData) return;
  
  queryClient.setQueryData<T>(queryKey, updateFn(oldData));
};

// Optimized helper for invalidating related entities
export const invalidateRelatedQueries = (entities: string[]) => {
  entities.forEach(entity => {
    const keyGenerator = createQueryKey[entity as keyof typeof createQueryKey];
    const key = keyGenerator && 'all' in keyGenerator ? keyGenerator.all : [entity];
    queryClient.invalidateQueries({ queryKey: key });
  });
};
