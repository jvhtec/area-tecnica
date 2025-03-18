
import { useState, useEffect, useCallback } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { formatDistanceToNow } from 'date-fns';

/**
 * Hook to monitor subscription status for specific tables with enhanced staleness detection
 * @param tables Array of table names to monitor
 * @returns Object containing detailed subscription status information
 */
export function useSubscriptionStatus(tables: string[]) {
  const { 
    subscriptionsByTable, 
    connectionStatus, 
    lastRefreshTime,
    forceRefresh 
  } = useSubscriptionContext();
  
  const [status, setStatus] = useState({
    isSubscribed: false,
    tablesSubscribed: [] as string[],
    tablesUnsubscribed: [] as string[],
    connectionStatus,
    lastRefreshTime: lastRefreshTime || 0,
    isStale: false,
    lastRefreshFormatted: '',
    refreshSubscription: () => {}
  });

  // Create a refresh function that's specific to these tables
  const refreshSubscription = useCallback(() => {
    forceRefresh(tables);
  }, [tables, forceRefresh]);

  // Update status whenever relevant state changes
  useEffect(() => {
    const tablesSubscribed: string[] = [];
    const tablesUnsubscribed: string[] = [];

    tables.forEach(table => {
      if (subscriptionsByTable[table]?.length > 0) {
        tablesSubscribed.push(table);
      } else {
        tablesUnsubscribed.push(table);
      }
    });

    // Calculate staleness with dynamic thresholds based on connection status
    let staleThreshold = 5 * 60 * 1000; // 5 minutes default
    
    // If we're disconnected, reduce threshold to mark as stale sooner
    if (connectionStatus !== 'connected') {
      staleThreshold = 60 * 1000; // 1 minute when disconnected
    }
    
    const isStale = Date.now() - lastRefreshTime > staleThreshold;
    
    // Format the last refresh time in a human-readable format
    let lastRefreshFormatted = 'unknown';
    try {
      lastRefreshFormatted = formatDistanceToNow(lastRefreshTime) + ' ago';
    } catch (error) {
      console.error('Error formatting last refresh time:', error);
    }

    setStatus({
      isSubscribed: tablesSubscribed.length === tables.length,
      tablesSubscribed,
      tablesUnsubscribed,
      connectionStatus,
      lastRefreshTime,
      isStale,
      lastRefreshFormatted,
      refreshSubscription
    });
  }, [tables, subscriptionsByTable, connectionStatus, lastRefreshTime, refreshSubscription]);

  return status;
}
