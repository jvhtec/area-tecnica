
// Re-export from the unified table subscription hook
import { useTableSubscription } from './useTableSubscription';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { useEffect } from 'react';

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
  const { forceSubscribe } = useSubscriptionContext();

  // Ensure subscriptions are established for the given tables with the right invalidation key
  useEffect(() => {
    try {
      const entries = tables.map(table => ({ table, queryKey, priority }));
      forceSubscribe(entries);
    } catch (e) {
      console.warn('useRelatedTablesSubscription: forceSubscribe not available:', e);
    }
    // We only want to run when tables or key/priority changes
  }, [JSON.stringify(tables), JSON.stringify(queryKey), priority, forceSubscribe]);

  // Create an array of table configurations
  const tableConfigs = tables.map(table => ({
    table,
    queryKey
  }));
  
  // Use individual table subscriptions for each table
  const results = tableConfigs.map(config => 
    useTableSubscription(config.table, config.queryKey)
  );
  
  // Determine overall subscription status
  const isSubscribed = results.every(result => result.isSubscribed);
  const isStale = results.some(result => result.isStale);
  
  // Create a mapping of table statuses
  const tableStatuses = tables.reduce((acc, table, index) => {
    acc[table] = results[index];
    return acc;
  }, {} as Record<string, any>);
  
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
    queryKey: string | string[]
  }>
) {
  // Convert tables array to format expected by useRelatedTablesSubscription
  const tableNames = tables.map(t => t.table);
  const queryKey = tables.length > 0 ? tables[0].queryKey : 'defaultKey';
  
  // Use the related tables subscription hook
  const result = useRelatedTablesSubscription(queryKey, tableNames);
  
  return result;
}
