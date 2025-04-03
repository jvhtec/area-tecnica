
import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedSubscriptionManager } from '@/lib/enhanced-subscription-manager';

/**
 * Hook to check the status of Supabase subscriptions and connection
 */
export function useSubscriptionStatus(tables: string[] = []) {
  const queryClient = useQueryClient();
  const manager = EnhancedSubscriptionManager.getInstance(queryClient);
  
  const [statuses, setStatuses] = useState<Record<string, any>>({});
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>(
    manager.getConnectionStatus()
  );
  
  // Initialize subscriptions if they don't exist
  useEffect(() => {
    const ensureSubscriptions = () => {
      tables.forEach(table => {
        const subscriptionStatus = manager.getSubscriptionStatus(table, table);
        if (!subscriptionStatus.isConnected) {
          manager.subscribeToTable(table, table);
        }
      });
    };
    
    ensureSubscriptions();
    const checkInterval = setInterval(ensureSubscriptions, 30000);
    
    return () => clearInterval(checkInterval);
  }, [tables, manager]);
  
  // Set up status monitoring interval
  useEffect(() => {
    const statusInterval = setInterval(() => {
      const newStatuses: Record<string, any> = {};
      tables.forEach(table => {
        newStatuses[table] = manager.getSubscriptionStatus(table, table);
      });
      
      setStatuses(newStatuses);
      setConnectionStatus(manager.getConnectionStatus());
    }, 2000);
    
    return () => clearInterval(statusInterval);
  }, [tables, manager]);
  
  // Get subscription status summary
  const tablesSubscribed = tables.filter(table => 
    statuses[table]?.isConnected
  );
  
  const tablesUnsubscribed = tables.filter(table => 
    !statuses[table]?.isConnected
  );
  
  const isSubscribed = tables.length > 0 && tablesSubscribed.length === tables.length;
  
  // Check for stale data
  const isStale = Object.values(statuses).some(status => {
    const now = Date.now();
    const staleDuration = 5 * 60 * 1000; // 5 minutes
    return now - (status?.lastActivity || 0) > staleDuration;
  });
  
  // Format the last refresh time
  const lastRefreshFormatted = formatDistanceToNow(new Date(lastRefreshTime), {
    addSuffix: true
  });
  
  // Function to refresh subscriptions
  const refreshSubscription = () => {
    tables.forEach(table => {
      // Refresh by recreating the subscription
      manager.unsubscribeFromTable(`${table}::${table}`);
      manager.subscribeToTable(table, table);
      
      // Invalidate the related query
      queryClient.invalidateQueries({ queryKey: [table] });
    });
    
    setLastRefreshTime(Date.now());
  };
  
  return {
    isSubscribed,
    tablesSubscribed,
    tablesUnsubscribed,
    lastRefreshTime,
    lastRefreshFormatted,
    connectionStatus,
    isStale,
    refreshSubscription,
    status: connectionStatus
  };
}
