
import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useTableSubscription } from './useUnifiedSubscription';
import { useState, useEffect } from 'react';
import { useSessionManager } from './useSessionManager';

/**
 * Enhanced hook that combines React Query with Supabase realtime subscriptions
 * and properly handles session state changes
 */
export function useEnhancedRealtimeQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  tableName: string,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, 
    'queryKey' | 'queryFn' | 'initialData'>
) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { session, status: sessionStatus } = useSessionManager();
  
  // Convert QueryKey to string or string[] as required by the hook
  const stringifiedQueryKey = Array.isArray(queryKey) 
    ? queryKey.map(item => String(item)) 
    : String(queryKey);
  
  // Call the subscription hook and track subscription status
  const { isSubscribed, isStale } = useTableSubscription(tableName, stringifiedQueryKey);
  
  // Use React Query for data fetching with retry logic
  const query = useQuery({
    queryKey,
    queryFn,
    ...options,
    // Override some options with our improved defaults
    retry: (failureCount, error) => {
      // Don't retry if session is not active
      if (sessionStatus !== 'active') return false;
      
      // Default retry behavior with maximum 3 retries
      return failureCount < 3;
    },
    // Prevent refetching if session is not active
    enabled: options?.enabled !== false && sessionStatus === 'active'
  });
  
  // Refresh data when session becomes active
  useEffect(() => {
    if (sessionStatus === 'active' && session) {
      // Don't refresh immediately to avoid thundering herd
      const timeout = setTimeout(() => {
        query.refetch();
      }, Math.random() * 1000); // Random delay up to 1 second
      
      return () => clearTimeout(timeout);
    }
  }, [session, sessionStatus, query]);
  
  // Function to manually refresh data
  const manualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await query.refetch();
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return {
    ...query,
    isSubscribed,
    isStale,
    isRefreshing,
    manualRefresh,
    sessionStatus
  };
}
