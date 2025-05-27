
import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { getRealtimeConnectionStatus } from '@/lib/supabase-client';
import { forceRefreshSubscriptions } from '@/lib/enhanced-supabase-client';

/**
 * Hook to monitor subscription status for specific tables
 * @param tableName Array of table names to monitor
 * @param queryKey Query key for this subscription
 * @returns Subscription status details
 */
export function useTableSubscription(
  tableName: string,
  queryKey: string | string[]
) {
  const { 
    connectionStatus: globalConnectionStatus, 
    activeSubscriptions, 
    lastRefreshTime,
    refreshSubscriptions,
    subscriptionsByTable
  } = useSubscriptionContext();

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  // Effect to update subscription status
  useEffect(() => {
    // Check if the table is actively subscribed
    const tableSubscriptions = subscriptionsByTable[tableName] || [];
    setIsSubscribed(tableSubscriptions.length > 0 && globalConnectionStatus === 'connected');
    
    // Check if data is stale (older than 5 minutes)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    setIsStale(now - lastRefreshTime > fiveMinutes);
    
    // Update last activity time
    if (tableSubscriptions.length > 0) {
      setLastActivity(lastRefreshTime);
    }
    
  }, [tableName, activeSubscriptions, globalConnectionStatus, lastRefreshTime, subscriptionsByTable]);

  // Function to refresh subscription for this specific table
  const refreshSubscription = async () => {
    console.log(`Refreshing subscription for table: ${tableName}`);
    
    try {
      // Ensure primary Supabase realtime connection is active
      const realtimeStatus = getRealtimeConnectionStatus();
      
      if (realtimeStatus !== 'CONNECTED') {
        // If not connected, force a connection refresh first
        await forceRefreshSubscriptions([tableName]);
      }
      
      // Then refresh all subscriptions in the provider
      refreshSubscriptions();
      
      return true;
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      return false;
    }
  };

  return {
    isSubscribed,
    isStale,
    lastActivity,
    refreshSubscription
  };
}

/**
 * Hook for subscribing to multiple tables at once
 */
export function useMultiTableSubscription(
  tables: Array<{ 
    table: string, 
    queryKey: string | string[]
  }>
) {
  const { 
    connectionStatus: globalConnectionStatus, 
    activeSubscriptions, 
    lastRefreshTime,
    refreshSubscriptions,
    subscriptionsByTable
  } = useSubscriptionContext();

  const [statuses, setStatuses] = useState<Record<string, any>>({});
  
  useEffect(() => {
    // Update statuses for each table
    const newStatuses: Record<string, any> = {};
    
    tables.forEach(({ table }) => {
      const tableSubscriptions = subscriptionsByTable[table] || [];
      const isSubscribed = tableSubscriptions.length > 0 && globalConnectionStatus === 'connected';
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      const isStale = now - lastRefreshTime > fiveMinutes;
      
      newStatuses[table] = {
        isSubscribed,
        isStale,
        lastActivity: tableSubscriptions.length > 0 ? lastRefreshTime : 0
      };
    });
    
    setStatuses(newStatuses);
  }, [tables, activeSubscriptions, globalConnectionStatus, lastRefreshTime, subscriptionsByTable]);

  // Check overall status
  const isAllSubscribed = Object.values(statuses).every(status => status?.isSubscribed);
  const isAnyStale = Object.values(statuses).some(status => status?.isStale);

  const refreshSubscription = async () => {
    try {
      // Get all table names
      const tableNames = tables.map(t => t.table);
      
      // Force refresh subscriptions for all tables
      await forceRefreshSubscriptions(tableNames);
      
      // Then refresh all subscriptions in the provider
      refreshSubscriptions();
      
      return true;
    } catch (error) {
      console.error('Error refreshing subscriptions:', error);
      return false;
    }
  };

  return {
    isSubscribed: isAllSubscribed,
    isStale: isAnyStale,
    tableStatuses: statuses,
    refreshSubscription
  };
}

/**
 * Hook for subscribing to a specific row in a table
 */
export function useRowSubscription(
  tableName: string,
  rowId: string,
  queryKey: string | string[]
) {
  // Use the base hook but could be enhanced with row-specific logic
  return useTableSubscription(tableName, queryKey);
}
