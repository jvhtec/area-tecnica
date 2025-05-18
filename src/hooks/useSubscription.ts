
// Re-export from the unified table subscription hook
export { useTableSubscription } from './useTableSubscription';

/**
 * Hook for subscribing to related tables that should all invalidate the same query
 */
export function useRelatedTablesSubscription(
  queryKey: string | string[],
  tables: string[],
  schema: string = 'public',
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
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
