
import { useState, useEffect, useCallback } from "react";
import { useQuery, UseQueryOptions, QueryKey, QueryFunction, UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  staleTime?: number;
}

/**
 * Hook that combines React Query with Supabase realtime subscriptions
 * for automatic data refreshing with connection resilience
 */
export function useRealtimeQuery<T>(
  queryKey: QueryKey,
  queryFn: QueryFunction<T, QueryKey>,
  tableName: string,
  options?: RealtimeQueryOptions<T>
): UseQueryResult<T> & { 
  manualRefresh: () => Promise<void>;
  isRefreshing: boolean;
  lastRefreshTime: number;
} {
  const [channelRef, setChannelRef] = useState<RealtimeChannel | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Setup the query with React Query
  const query = useQuery<T>({
    queryKey,
    queryFn,
    ...options
  });

  // Function to manually refresh data
  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await query.refetch();
      setLastRefreshTime(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, [query]);

  // Set up Supabase realtime subscription for the table
  useEffect(() => {
    // Generate a unique channel name
    const channelName = `${tableName}-${queryKey[0]}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`Creating realtime subscription for ${tableName} with channel ${channelName}`);
    
    // Create the channel
    const channel = supabase.channel(channelName);
    
    // Add the postgres_changes handler
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: tableName },
      async (payload) => {
        console.log(`Received ${payload.eventType} for ${tableName}:`, payload);
        await manualRefresh();
      }
    );
    
    // Add a system handler to detect connection issues
    channel.on('system', { event: '*' }, (payload) => {
      if (payload.type === 'connected') {
        console.log(`Realtime channel ${channelName} connected`);
      } else if (payload.type === 'disconnected') {
        console.log(`Realtime channel ${channelName} disconnected`);
      } else if (payload.type === 'error') {
        console.error(`Error in realtime channel ${channelName}:`, payload);
        
        // Try to reconnect after an error
        setTimeout(() => {
          console.log(`Attempting to reconnect channel ${channelName}`);
          channel.subscribe();
        }, 5000);
      }
    });
    
    // Subscribe to the channel
    channel.subscribe();
    
    // Store the channel reference
    setChannelRef(channel);
    
    // Clean up the subscription when the component unmounts
    return () => {
      console.log(`Cleaning up realtime subscription for ${tableName}`);
      supabase.removeChannel(channel);
    };
  }, [tableName, queryKey.toString(), manualRefresh]);

  // Listen for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only refetch if the option is enabled and we have a valid query
        if (options?.refetchOnWindowFocus !== false) {
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          
          // Only refetch if it's been more than 10 seconds since the last refresh
          if (timeSinceLastRefresh > 10000) {
            console.log(`Tab became visible, refreshing ${tableName} data`);
            manualRefresh();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tableName, manualRefresh, lastRefreshTime, options?.refetchOnWindowFocus]);

  // Listen for online status changes
  useEffect(() => {
    const handleOnline = () => {
      // Only refetch if the option is enabled
      if (options?.refetchOnReconnect !== false) {
        console.log(`Network reconnected, refreshing ${tableName} data`);
        manualRefresh();
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [tableName, manualRefresh, options?.refetchOnReconnect]);

  // Listen for global force-data-refresh events
  useEffect(() => {
    const handleForceRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(`Force refresh event received for ${tableName}, reason:`, customEvent.detail?.reason);
      manualRefresh();
    };
    
    window.addEventListener('force-data-refresh', handleForceRefresh);
    
    return () => {
      window.removeEventListener('force-data-refresh', handleForceRefresh);
    };
  }, [tableName, manualRefresh]);

  return {
    ...query,
    manualRefresh,
    isRefreshing,
    lastRefreshTime
  };
}
