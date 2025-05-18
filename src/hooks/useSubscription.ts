
// Re-export from the unified table subscription hook
export { 
  useTableSubscription,
  useMultiTableSubscription,
  useRowSubscription
} from './useTableSubscription';

/**
 * Hook for subscribing to related tables that should all invalidate the same query
 */
export function useRelatedTablesSubscription(
  queryKey: string | string[],
  tables: string[],
  schema: string = 'public',
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const tableConfigs = tables.map(table => ({
    table,
    queryKey,
    filter: { schema },
    priority
  }));
  
  return useMultiTableSubscription(tableConfigs);
}
