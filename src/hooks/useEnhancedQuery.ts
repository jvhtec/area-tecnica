
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { useEnhancedSubscription } from './useEnhancedSubscription';
import { toast } from 'sonner';

/**
 * Enhanced hook that combines React Query with Supabase real-time updates
 * and provides automatic recovery from stale data
 */
export function useEnhancedQuery<TData, TError = Error>(
  queryKey: string | string[],
  queryFn: () => Promise<TData>,
  table: string,
  options?: Omit<
    UseQueryOptions<TData, TError, TData, (string | string[])[]>,
    'queryKey' | 'queryFn'
  >
): UseQueryResult<TData, TError> & { 
  isRefreshing: boolean; 
  manualRefresh: () => Promise<void>;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'; 
} {
  // State for tracking manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Set up enhanced subscription
  const { status: connectionStatus, resetSubscription } = useEnhancedSubscription(
    table, 
    queryKey
  );
  
  // Normalize queryKey to array format for React Query
  const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];
  
  // Use React Query to fetch the data with enhanced options
  const queryResult = useQuery({
    queryKey: normalizedQueryKey,
    queryFn: async () => {
      try {
        const result = await queryFn();
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
    // Poll if subscription not working (5 minute interval)
    refetchInterval: connectionStatus !== 'connected' ? 1000 * 60 * 5 : undefined,
    ...options,
  });

  // Handle auto-reconnection for stale subscriptions
  useEffect(() => {
    if (connectionStatus === 'error' || connectionStatus === 'disconnected') {
      const reconnectTimeout = setTimeout(() => {
        resetSubscription();
        queryResult.refetch();
      }, 30000); // Try to reconnect after 30 seconds
      
      return () => clearTimeout(reconnectTimeout);
    }
  }, [connectionStatus, resetSubscription, queryResult]);

  // Manual refresh function with user feedback
  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryResult.refetch();
      if (connectionStatus !== 'connected') {
        resetSubscription();
      }
      toast.success(`${table} data refreshed successfully`);
    } catch (error) {
      console.error(`Error refreshing ${table} data:`, error);
      toast.error(`Failed to refresh ${table} data`);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryResult, table, connectionStatus, resetSubscription]);

  return {
    ...queryResult,
    isRefreshing,
    manualRefresh,
    connectionStatus
  };
}
