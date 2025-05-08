
import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useTableSubscription } from './useUnifiedSubscription';
import { useState, useEffect } from 'react';
import { useConnectionStatus } from './useConnectionStatus';

/**
 * Hook that combines React Query with Supabase realtime subscriptions
 * with improved inactivity handling
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
  
  // Get connection status
  const { connectionState, isStale: isConnectionStale } = useConnectionStatus();
  
  // Determine overall staleness (either subscription or connection)
  const isDataStale = isStale || isConnectionStale;
  
  // Configure optimal staleTime based on table importance
  // Critical tables should have lower stale time for quicker updates
  const getOptimalStaleTime = () => {
    // Check if this is a critical table
    const criticalTables = ['jobs', 'profiles', 'job_assignments'];
    if (criticalTables.includes(tableName)) {
      return 60 * 1000; // 1 minute for critical tables
    }
    
    // Higher stale time for less critical tables
    return 2 * 60 * 1000; // 2 minutes for regular tables
  };
  
  // Adjust refetch interval based on if the tab is visible
  const getRefetchInterval = () => {
    return document.visibilityState === 'visible' 
      ? 5 * 60 * 1000 // 5 minutes when visible
      : false; // No automatic refetch when not visible
  };
  
  // Use React Query for data fetching with optimized settings
  const query = useQuery({
    queryKey,
    queryFn,
    staleTime: getOptimalStaleTime(),
    refetchInterval: getRefetchInterval(),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    ...options
  });
  
  // Effect to handle stale data and connection issues
  useEffect(() => {
    // If data is stale and component is mounted, refetch
    if (isDataStale && !isRefreshing && document.visibilityState === 'visible') {
      console.log(`[useRealtimeQuery] Stale data detected for ${tableName}, refreshing`);
      manualRefresh();
    }
  }, [isDataStale]);
  
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
    isStale: isDataStale,
    isRefreshing,
    manualRefresh,
    connectionState
  };
}
