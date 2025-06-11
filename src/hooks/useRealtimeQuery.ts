
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { useTableSubscription } from './useSubscription';
import { toast } from 'sonner';

/**
 * Enhanced hook that combines React Query with Supabase real-time updates
 * and provides automatic recovery from stale data
 * @param queryKey The query key for React Query
 * @param queryFn The query function for fetching data
 * @param table The table name to subscribe to for real-time updates
 * @param options Additional React Query options
 * @returns UseQueryResult with the data, status and refetch function
 */
export function useRealtimeQuery<TData, TError = Error>(
  queryKey: string | string[],
  queryFn: () => Promise<TData>,
  table: string,
  options?: Omit<
    UseQueryOptions<TData, TError, TData, (string | string[])[]>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<TData, TError> & { isRefreshing: boolean; manualRefresh: () => Promise<void> } {
  // State for tracking manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState(Date.now());
  const [isStale, setIsStale] = useState(false);
  
  // Set up the subscription to the table
  useTableSubscription(table, queryKey);
  
  // Normalize queryKey to array format for React Query
  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];
  
  // Use React Query to fetch the data with enhanced options
  const queryResult = useQuery({
    queryKey: normalizedQueryKey,
    queryFn: async () => {
      try {
        const result = await queryFn();
        // Update last successful fetch time
        setLastSuccessfulFetch(Date.now());
        setIsStale(false);
        return result;
      } catch (error) {
        console.error(`Error fetching data for ${table}:`, error);
        throw error;
      }
    },
    // Default stale time to 2 minutes if not specified
    staleTime: (options?.staleTime !== undefined) ? options.staleTime : 1000 * 60 * 2,
    // Add retry with exponential backoff
    retry: (options?.retry !== undefined) ? options.retry : 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });

  // Check for stale data periodically
  useEffect(() => {
    const staleCheckInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      if (now - lastSuccessfulFetch > staleThreshold) {
        setIsStale(true);
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(staleCheckInterval);
  }, [lastSuccessfulFetch]);

  // Automatically refresh when tab becomes visible after being hidden
  useEffect(() => {
    let lastVisibilityChange = 0;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Only refresh if it's been at least 30 seconds since last visibility change
        if (now - lastVisibilityChange > 30000) {
          lastVisibilityChange = now;
          
          // If data is stale or it's been more than 2 minutes, refresh
          if (isStale || now - lastSuccessfulFetch > 2 * 60 * 1000) {
            queryResult.refetch();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryResult, lastSuccessfulFetch, isStale]);

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

  // If data is stale for too long, auto-refresh
  useEffect(() => {
    if (isStale) {
      const autoRefreshTimeout = setTimeout(() => {
        queryResult.refetch();
      }, 60000); // Auto-refresh after 1 minute of staleness
      
      return () => clearTimeout(autoRefreshTimeout);
    }
  }, [isStale, queryResult]);

  return {
    ...queryResult,
    isRefreshing,
    manualRefresh
  };
}
