
import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useTableSubscription } from './useTableSubscription';
import { useState, useEffect, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";

/**
 * Enhanced hook that combines React Query with Supabase realtime subscriptions
 * for efficient data loading and real-time updates
 * 
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
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(Date.now());
  const [lastErrorTime, setLastErrorTime] = useState<number | null>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(true);
  
  // Convert QueryKey to string or string[] as required by the hook
  const stringifiedQueryKey = Array.isArray(queryKey) 
    ? queryKey.map(item => String(item)) 
    : String(queryKey);
  
  // Call the subscription hook with improved error monitoring
  const { isSubscribed, isStale } = useTableSubscription(
    tableName, 
    stringifiedQueryKey, 
    {
      onSubscriptionError: () => setSubscriptionActive(false),
      onSubscriptionReconnect: () => setSubscriptionActive(true)
    }
  );
  
  // Track subscription status changes
  useEffect(() => {
    if (!isSubscribed && subscriptionActive) {
      console.log(`Subscription connection issue for table ${tableName}. Data fetching will continue but won't auto-update.`);
    } else if (isSubscribed && !subscriptionActive) {
      console.log(`Subscription reconnected for table ${tableName}.`);
      setSubscriptionActive(true);
    }
  }, [isSubscribed, subscriptionActive, tableName]);
  
  // Enhanced query function with performance tracking and error handling
  const enhancedQueryFn = useCallback(async () => {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      
      // Track successful fetches with performance metrics
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow query detected for ${String(queryKey)}: ${duration.toFixed(2)}ms`);
      }
      
      setLastSuccessTime(Date.now());
      setLastErrorTime(null);
      
      return result;
    } catch (error) {
      // Track and log errors
      setLastErrorTime(Date.now());
      
      console.error(`Error fetching data for ${String(queryKey)}:`, error);
      throw error;
    }
  }, [queryFn, queryKey]);
  
  // Use React Query with our enhanced query function
  const query = useQuery({
    queryKey,
    queryFn: enhancedQueryFn,
    ...options,
    // Enable background refresh with shorter staleTime for time-sensitive data
    staleTime: options?.staleTime ?? (tableName.includes('messages') || tableName.includes('notifications') ? 30000 : 300000),
  });
  
  // Function to manually refresh data with enhanced error handling and retry logic
  const manualRefresh = useCallback(async () => {
    // Prevent concurrent refreshes
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      console.log(`Manually refreshing data for ${String(queryKey)}...`);
      
      // Then refetch data
      await query.refetch();
      
      // Update last success time
      setLastSuccessTime(Date.now());
      setLastErrorTime(null);
      
      return true;
    } catch (error) {
      console.error(`Error in manual refresh for ${String(queryKey)}:`, error);
      
      // Only show toast on user-initiated refreshes
      toast.error(`Failed to refresh ${tableName} data`, { 
        description: 'Please try again'
      });
      
      setLastErrorTime(Date.now());
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, query, queryKey, tableName]);
  
  // Refresh stale data automatically
  useEffect(() => {
    if (isStale && !query.isFetching && !isRefreshing) {
      console.log(`Stale data detected for ${String(queryKey)}, refreshing...`);
      
      manualRefresh().catch(err => {
        console.error(`Error auto-refreshing stale data for ${String(queryKey)}:`, err);
      });
    }
  }, [isStale, manualRefresh, query.isFetching, queryKey, isRefreshing]);
  
  return {
    ...query,
    isSubscribed,
    isStale,
    isRefreshing: isRefreshing || query.isFetching,
    manualRefresh,
    lastSuccessTime,
    lastErrorTime,
    subscriptionActive
  };
}
