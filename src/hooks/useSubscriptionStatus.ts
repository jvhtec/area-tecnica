
import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';

/**
 * Hook to monitor subscription status for specific tables
 * @param tables Array of table names to monitor
 * @returns Object containing subscription status information
 */
export function useSubscriptionStatus(tables: string[]) {
  const { subscriptionsByTable, connectionStatus, lastRefreshTime } = useSubscriptionContext();
  const [status, setStatus] = useState({
    isSubscribed: false,
    tablesSubscribed: [] as string[],
    tablesUnsubscribed: [] as string[],
    connectionStatus,
    lastRefreshTime: lastRefreshTime || 0,
    isStale: false
  });

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

    // Calculate staleness - if last refresh was more than 5 minutes ago
    const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000;

    setStatus({
      isSubscribed: tablesSubscribed.length === tables.length,
      tablesSubscribed,
      tablesUnsubscribed,
      connectionStatus,
      lastRefreshTime,
      isStale
    });
  }, [tables, subscriptionsByTable, connectionStatus, lastRefreshTime]);

  return status;
}
