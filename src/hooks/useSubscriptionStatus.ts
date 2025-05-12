
import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';

/**
 * Hook to monitor the subscription status for specific tables
 * @param tables Array of table names to check subscription status
 * @returns Status information about the subscriptions
 */
export function useSubscriptionStatus(tables: string[]) {
  // Ensure we always have a valid array
  const tablesToCheck = Array.isArray(tables) ? tables : [];
  
  const queryClient = useQueryClient();
  const manager = queryClient ? UnifiedSubscriptionManager.getInstance(queryClient) : null;
  
  const context = useSubscriptionContext();
  const connectionStatus = context?.connectionStatus || 'disconnected';
  const lastRefreshTime = context?.lastRefreshTime || Date.now();
  const refreshSubscriptions = context?.refreshSubscriptions || (() => {});
  
  const [status, setStatus] = useState({
    isSubscribed: false,
    tablesSubscribed: [] as string[],
    tablesUnsubscribed: [] as string[],
    connectionStatus,
    lastRefreshTime,
    lastRefreshFormatted: '',
    isStale: false
  });
  
  // Update status when context changes
  useEffect(() => {
    if (!manager) {
      setStatus(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        isSubscribed: false,
        tablesSubscribed: [],
        tablesUnsubscribed: tablesToCheck
      }));
      return;
    }
    
    try {
      // Get current subscription status
      const subscriptionsByTable = manager.getSubscriptionsByTable ? manager.getSubscriptionsByTable() || {} : {};
      
      // Determine which tables are subscribed vs unsubscribed
      const tablesSubscribed = tablesToCheck.filter(
        table => subscriptionsByTable[table]?.length > 0
      );
      
      const tablesUnsubscribed = tablesToCheck.filter(
        table => !subscriptionsByTable[table] || subscriptionsByTable[table].length === 0
      );
      
      // Format the last refresh time
      let lastRefreshFormatted = "Unknown";
      try {
        if (lastRefreshTime) {
          lastRefreshFormatted = formatDistanceToNow(lastRefreshTime, { addSuffix: true });
        }
      } catch (error) {
        console.error("Error formatting refresh time:", error);
      }
      
      // Check if all required tables are subscribed
      const isSubscribed = tablesUnsubscribed.length === 0 && tablesToCheck.length > 0;
      
      // Check if data is stale (older than 5 minutes)
      const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000;
      
      setStatus({
        isSubscribed,
        tablesSubscribed,
        tablesUnsubscribed,
        connectionStatus,
        lastRefreshTime,
        lastRefreshFormatted,
        isStale
      });
    } catch (error) {
      console.error("Error updating subscription status:", error);
      
      // Set safe defaults in case of error
      setStatus({
        isSubscribed: false,
        tablesSubscribed: [],
        tablesUnsubscribed: tablesToCheck,
        connectionStatus: 'disconnected',
        lastRefreshTime,
        lastRefreshFormatted: 'Error',
        isStale: true
      });
    }
  }, [tablesToCheck, connectionStatus, lastRefreshTime, manager]);
  
  // Function to manually refresh subscriptions
  const refreshSubscription = () => {
    if (!queryClient) return;
    
    refreshSubscriptions();
    console.log('Manually refreshed subscriptions for tables:', tablesToCheck);
    
    // Also invalidate related queries
    tablesToCheck.forEach(table => {
      if (table) {
        queryClient.invalidateQueries({ queryKey: [table] });
      }
    });
  };
  
  return {
    ...status,
    refreshSubscription
  };
}
