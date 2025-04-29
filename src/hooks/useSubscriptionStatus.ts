
import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { formatDistanceToNow } from 'date-fns';

/**
 * Hook to monitor the subscription status for specific tables
 * @param tables Array of table names to check subscription status
 * @returns Status information about the subscriptions
 */
export function useSubscriptionStatus(tables: string[]) {
  const { 
    subscriptionsByTable, 
    connectionStatus, 
    refreshSubscriptions,
    lastRefreshTime
  } = useSubscriptionContext();
  
  const [status, setStatus] = useState({
    isSubscribed: false,
    tablesSubscribed: [] as string[],
    tablesUnsubscribed: [] as string[],
    connectionStatus: connectionStatus,
    lastRefreshTime,
    lastRefreshFormatted: '',
    isStale: false
  });
  
  // Update status when context changes
  useEffect(() => {
    // Determine which tables are subscribed vs unsubscribed
    const tablesSubscribed = tables.filter(
      table => subscriptionsByTable[table]?.length > 0
    );
    
    const tablesUnsubscribed = tables.filter(
      table => !subscriptionsByTable[table] || subscriptionsByTable[table].length === 0
    );
    
    // Format the last refresh time
    let lastRefreshFormatted = "Unknown";
    try {
      lastRefreshFormatted = formatDistanceToNow(lastRefreshTime, { addSuffix: true });
    } catch (error) {
      console.error("Error formatting refresh time:", error);
    }
    
    // Check if all required tables are subscribed
    const isSubscribed = tablesUnsubscribed.length === 0 && tables.length > 0;
    
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
  }, [tables, subscriptionsByTable, connectionStatus, lastRefreshTime]);
  
  // Function to manually refresh a subscription
  const refreshSubscription = () => {
    refreshSubscriptions();
    console.log('Manually refreshed subscriptions for tables:', tables);
  };
  
  return {
    ...status,
    refreshSubscription
  };
}
