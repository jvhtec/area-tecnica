
// Re-export from the unified table subscription hook
import { useTableSubscription } from './useTableSubscription';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useEffect, useMemo } from 'react';

// Export the useTableSubscription hook
export { useTableSubscription };

/**
 * Hook for subscribing to related tables that should all invalidate the same query
 */
export function useRelatedTablesSubscription(
  queryKey: string | string[],
  tables: string[],
  schema: string = 'public',
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const { forceSubscribe, subscriptionsByTable, connectionStatus, lastRefreshTime } = useSubscriptionContext();
  const stableTables = useMemo(() => JSON.stringify(tables), [tables]);
  const stableQueryKey = useMemo(() => JSON.stringify(queryKey), [queryKey]);

  // Ensure subscriptions are established for the given tables with the right invalidation key
  useEffect(() => {
    try {
      const entries = tables.map(table => ({ table, queryKey, priority }));
      forceSubscribe(entries);
    } catch (e) {
      console.warn('useRelatedTablesSubscription: forceSubscribe not available:', e);
    }
    // We only want to run when tables or key/priority changes
  }, [forceSubscribe, priority, stableQueryKey, stableTables]);

  const tableStatuses = useMemo(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return tables.reduce((acc, table) => {
      const isSubscribed = (subscriptionsByTable[table]?.length ?? 0) > 0 && connectionStatus === 'connected';
      acc[table] = {
        isSubscribed,
        isStale: now - lastRefreshTime > fiveMinutes,
        lastActivity: lastRefreshTime,
      };
      return acc;
    }, {} as Record<string, any>);
  }, [connectionStatus, lastRefreshTime, subscriptionsByTable, tables]);

  const isSubscribed = tables.every((table) => (subscriptionsByTable[table]?.length ?? 0) > 0) && connectionStatus === 'connected';
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000;
  
  return {
    isSubscribed,
    isStale,
    tableStatuses,
    // This is a no-op as we can't directly refresh subscriptions
    refreshSubscription: async () => true
  };
}

/**
 * Hook for subscribing to multiple tables at once
 * Alternative name for useRelatedTablesSubscription for backward compatibility
 */
export function useMultiTableSubscription(
  tables: Array<{ 
    table: string, 
    queryKey: string | string[],
    priority?: 'high' | 'medium' | 'low'
  }>
) {
  const { forceSubscribe, subscriptionsByTable, connectionStatus, lastRefreshTime } = useSubscriptionContext();

  const stableTables = useMemo(() => JSON.stringify(tables), [tables]);

  useEffect(() => {
    try {
      const entries = tables.map(({ table, queryKey, priority }) => ({
        table,
        queryKey,
        priority,
      }));
      forceSubscribe(entries);
    } catch (e) {
      console.warn('useMultiTableSubscription: forceSubscribe not available:', e);
    }
  }, [forceSubscribe, stableTables]);

  const tableStatuses = useMemo(() => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return tables.reduce((acc, { table }) => {
      const isSubscribed = (subscriptionsByTable[table]?.length ?? 0) > 0 && connectionStatus === 'connected';
      acc[table] = {
        isSubscribed,
        isStale: now - lastRefreshTime > fiveMinutes,
        lastActivity: lastRefreshTime,
      };
      return acc;
    }, {} as Record<string, any>);
  }, [connectionStatus, lastRefreshTime, subscriptionsByTable, tables]);

  const isSubscribed =
    connectionStatus === 'connected' && tables.every(({ table }) => (subscriptionsByTable[table]?.length ?? 0) > 0);
  const isStale = Date.now() - lastRefreshTime > 5 * 60 * 1000;

  return {
    isSubscribed,
    isStale,
    tableStatuses,
    refreshSubscription: async () => true,
  };
}
