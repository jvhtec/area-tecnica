import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { formatDistanceToNow } from 'date-fns';
import { getRealtimeConnectionStatus } from '@/lib/supabase-client';
import { forceRefreshSubscriptions } from '@/lib/enhanced-supabase-client';

/**
 * Hook to monitor subscription status for specific tables
 * @param tables Array of table names to monitor
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
 * with automatic route registration and cleanup.
 */
export function useMultiTableSubscription(
  tables: Array<{
    table: string,
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    },
    priority?: 'high' | 'medium' | 'low'
  }>
) {
  const queryClient = useQueryClient();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const location = useLocation();
  
  useEffect(() => {
    console.log(`Setting up subscription to multiple tables: ${tables.map(t => t.table).join(', ')}`);
    
    // Subscribe to all tables
    const subscription = manager.subscribeToTables(tables);
    
    // Register all subscriptions with current route
    tables.forEach(({ table, queryKey }) => {
      const subscriptionKey = Array.isArray(queryKey) 
        ? `${table}::${JSON.stringify(queryKey)}`
        : `${table}::${queryKey}`;
      
      manager.registerRouteSubscription(location.pathname, subscriptionKey);
    });
    
    // Cleanup on unmount
    return () => {
      // Note: actual unsubscription will be handled by the manager based on route usage
      console.log(`Component using multiple table subscriptions unmounted`);
    };
  }, [JSON.stringify(tables), location.pathname, manager]);
  
  // Get subscription statuses
  const statuses = tables.map(({ table, queryKey }) => {
    const status = manager.getSubscriptionStatus(table, queryKey);
    return {
      table,
      queryKey,
      isSubscribed: status.isConnected,
      lastActivity: status.lastActivity,
      isStale: Date.now() - status.lastActivity > 5 * 60 * 1000
    };
  });
  
  // Aggregate status
  const isAllSubscribed = statuses.every(s => s.isSubscribed);
  const isAnyStale = statuses.some(s => s.isStale);
  
  return {
    isSubscribed: isAllSubscribed,
    isStale: isAnyStale,
    tableStatuses: statuses,
    refreshSubscriptions: () => {
      manager.forceRefreshSubscriptions(tables.map(t => t.table));
      queryClient.invalidateQueries();
    }
  };
}

/**
 * Hook for subscribing to a specific row in a table
 */
export function useRowSubscription(
  table: string,
  rowId: string,
  queryKey: string | string[]
) {
  return useTableSubscription(
    table,
    queryKey,
    { filter: `id=eq.${rowId}` }
  );
}
