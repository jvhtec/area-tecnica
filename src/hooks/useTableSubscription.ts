
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
