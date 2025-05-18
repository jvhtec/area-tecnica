
import { useQuery, QueryKey, UseQueryOptions } from '@tanstack/react-query';
import { useTableSubscription } from './useTableSubscription';
import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";

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
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(Date.now());
  
  // Convert QueryKey to string or string[] as required by the hook
  const stringifiedQueryKey = Array.isArray(queryKey) 
    ? queryKey.map(item => String(item)) 
    : String(queryKey);
  
  // Call the subscription hook and track subscription status
  const { isSubscribed, isStale, refreshSubscription } = useTableSubscription(tableName, stringifiedQueryKey);
  
  // Track query state changes for debugging
  useEffect(() => {
    if (!isSubscribed) {
      console.log(`Subscription inactive for table ${tableName}. Data fetching will continue but won't auto-update.`);
    }
  }, [isSubscribed, tableName]);
  
  // Use React Query for data fetching
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await queryFn();
        // Track successful fetches
        setLastSuccessTime(Date.now());
        return result;
      } catch (error) {
        // Log and re-throw error
        console.error(`Error fetching data for ${String(queryKey)}:`, error);
        throw error;
      }
    },
    ...options
  });
  
  // Function to manually refresh data with enhanced error handling
  const manualRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      console.log(`Manually refreshing data for ${String(queryKey)}...`);
      
      // First try to refresh the subscription
      if (!isSubscribed && refreshSubscription) {
        await refreshSubscription();
      }
      
      // Then refetch data
      await query.refetch();
      
      // Update last success time
      setLastSuccessTime(Date.now());
    } catch (error) {
      console.error(`Error in manual refresh for ${String(queryKey)}:`, error);
      toast.error(`Failed to refresh ${tableName} data`, { 
        description: 'Please try again'
      });
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return {
    ...query,
    isSubscribed,
    isStale,
    isRefreshing: isRefreshing || query.isFetching,
    manualRefresh,
    lastSuccessTime
  };
}
