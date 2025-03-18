
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useTableSubscription } from './useSubscription';

/**
 * Hook that combines React Query with Supabase real-time updates
 * @param queryKey The query key for React Query
 * @param queryFn The query function for fetching data
 * @param table The table name to subscribe to for real-time updates
 * @param options Additional React Query options
 * @returns UseQueryResult with the data and status
 */
export function useRealtimeQuery<TData, TError = Error>(
  queryKey: string | string[],
  queryFn: () => Promise<TData>,
  table: string,
  options?: Omit<
    UseQueryOptions<TData, TError, TData, (string | string[])[]>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<TData, TError> {
  // Set up the subscription to the table
  useTableSubscription(table, queryKey);
  
  // Normalize queryKey to array format for React Query
  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];
  
  // Use React Query to fetch the data
  return useQuery({
    queryKey: normalizedQueryKey,
    queryFn,
    ...options
  });
}
