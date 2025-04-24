
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { useTableSubscription } from './useSubscription';
import { toast } from 'sonner';

export function useRealtimeQuery<TData, TError = Error>(
  queryKey: string | string[],
  queryFn: () => Promise<TData>,
  table: string,
  options?: Omit<
    UseQueryOptions<TData, TError, TData, (string | string[])[]>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<TData, TError> & { isRefreshing: boolean; manualRefresh: () => Promise<void> } {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(Date.now());
  const [isStale, setIsStale] = useState(false);
  
  // Set up the subscription to the table
  useTableSubscription(table, queryKey);
  
  // Normalize queryKey to array format
  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];
  
  const queryResult = useQuery({
    queryKey: normalizedQueryKey,
    queryFn: async () => {
      try {
        const result = await queryFn();
        setLastSuccessfulFetch(Date.now());
        setIsStale(false);
        return result;
      } catch (error) {
        console.error(`Error fetching data for ${table}:`, error);
        throw error;
      }
    },
    staleTime: (options?.staleTime !== undefined) ? options.staleTime : 1000 * 60 * 2,
    retry: (options?.retry !== undefined) ? options.retry : 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });

  // Manual refresh function with user feedback
  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryResult.refetch();
      setIsStale(false);
      toast.success(`${table} data refreshed successfully`);
    } catch (error) {
      console.error(`Error refreshing ${table} data:`, error);
      toast.error(`Failed to refresh ${table} data`);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryResult, table]);

  return {
    ...queryResult,
    isRefreshing,
    manualRefresh
  };
}
