
import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useTableSubscription } from './useUnifiedSubscription';
import { useState } from 'react';

/**
 * Hook that combines React Query with Supabase realtime subscriptions
 * @param queryKey The query key for React Query
 * @param queryFn The query function
 * @param tableName The table name to subscribe to
 * @param options Additional query options
 * @returns Query result plus additional helpers
 */
export function useRealtimeQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  tableName: string,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 
    'queryKey' | 'queryFn' | 'initialData'>
) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Convert QueryKey to string or string[] as required by the hook
  const stringifiedQueryKey = Array.isArray(queryKey) 
    ? queryKey.map(item => String(item)) 
    : String(queryKey);
  
  // Call the subscription hook and track subscription status
  const { isSubscribed, isStale } = useTableSubscription(tableName, stringifiedQueryKey);
  
  // Use React Query for data fetching
  const query = useQuery({
    queryKey,
    queryFn,
    ...options
  });
  
  // Function to manually refresh data
  const manualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return {
    ...query,
    isSubscribed,
    isStale,
    isRefreshing,
    manualRefresh
  };
}
