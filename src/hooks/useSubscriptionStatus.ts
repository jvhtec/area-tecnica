
import { useState, useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';

/**
 * Hook to monitor subscription status for specific tables
 * @param tables Array of table names to monitor
 * @returns Object containing subscription status information
 */
export function useSubscriptionStatus(tables: string[]) {
  const { subscriptionsByTable, connectionStatus } = useSubscriptionContext();
  const [status, setStatus] = useState({
    isSubscribed: false,
    tablesSubscribed: [] as string[],
    tablesUnsubscribed: [] as string[],
    connectionStatus
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

    setStatus({
      isSubscribed: tablesSubscribed.length === tables.length,
      tablesSubscribed,
      tablesUnsubscribed,
      connectionStatus
    });
  }, [tables, subscriptionsByTable, connectionStatus]);

  return status;
}
