
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
export function useSubscriptionStatus(tables: string[]) {
  const { 
    connectionStatus: globalConnectionStatus, 
    activeSubscriptions, 
    lastRefreshTime,
    refreshSubscriptions,
    subscriptionsByTable
  } = useSubscriptionContext();

  const [tablesSubscribed, setTablesSubscribed] = useState<string[]>([]);
  const [tablesUnsubscribed, setTablesUnsubscribed] = useState<string[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [supportsRealtime, setSupportsRealtime] = useState(true);

  // Effect to update table subscription status
  useEffect(() => {
    // Check which tables are actively subscribed
    const subscribed: string[] = [];
    const unsubscribed: string[] = [];
    
    tables.forEach(table => {
      const tableSubscriptions = subscriptionsByTable[table] || [];
      if (tableSubscriptions.length > 0) {
        subscribed.push(table);
      } else {
        unsubscribed.push(table);
      }
    });
    
    setTablesSubscribed(subscribed);
    setTablesUnsubscribed(unsubscribed);
    setIsSubscribed(unsubscribed.length === 0 && globalConnectionStatus === 'connected');
    
    // Check if data is stale (older than 5 minutes)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    setIsStale(now - lastRefreshTime > fiveMinutes);
    
    // Check if realtime is supported for these tables
    const directRealtimeSupport = tables.every(table => 
      ['jobs', 'job_assignments', 'job_date_types', 'job_departments', 'profiles',
       'festival_artists', 'festival_shifts', 'festival_shift_assignments',
       'messages', 'direct_messages'].includes(table)
    );
    setSupportsRealtime(directRealtimeSupport);
    
  }, [tables, activeSubscriptions, globalConnectionStatus, lastRefreshTime, subscriptionsByTable]);
  
  // Format the last refresh time for display
  const lastRefreshFormatted = formatDistanceToNow(lastRefreshTime, { addSuffix: true });
  
  // Function to refresh all subscriptions for the specified tables
  const refreshSubscription = async () => {
    console.log(`Refreshing subscriptions for tables: ${tables.join(', ')}`);
    
    try {
      // Ensure primary Supabase realtime connection is active
      const realtimeStatus = getRealtimeConnectionStatus();
      
      if (realtimeStatus !== 'CONNECTED') {
        // If not connected, force a connection refresh first
        await forceRefreshSubscriptions(tables);
      }
      
      // Then refresh all subscriptions in the provider
      refreshSubscriptions();
      
      return true;
    } catch (error) {
      console.error('Error refreshing subscriptions:', error);
      return false;
    }
  };

  return {
    isSubscribed,
    tablesSubscribed,
    tablesUnsubscribed,
    connectionStatus: globalConnectionStatus,
    lastRefreshTime,
    lastRefreshFormatted,
    isStale,
    supportsRealtime,
    refreshSubscription
  };
}
