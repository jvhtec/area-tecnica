
import { useEffect } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

/**
 * Hook for accessing subscription context information
 */
export function useSubscription() {
  return useSubscriptionContext();
}

/**
 * Hook for subscribing to a specific table with automatic route registration
 */
export function useTableSubscription(
  tableName: string,
  queryKey?: string,
  filter?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    schema?: string,
    filter?: string
  },
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const queryClient = useQueryClient();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const { subscriptionsByTable } = useSubscriptionContext();
  const location = useLocation();
  
  useEffect(() => {
    // Use provided query key or default to table name
    const actualQueryKey = queryKey || tableName;
    
    // Subscribe to the table
    const subscription = manager.subscribeToTable(tableName, actualQueryKey, filter, priority);
    
    // Register this subscription with the current route
    const subscriptionKey = `${tableName}::${typeof actualQueryKey === 'string' ? actualQueryKey : JSON.stringify(actualQueryKey)}`;
    manager.registerRouteSubscription(location.pathname, subscriptionKey);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [tableName, queryKey, filter, priority, location.pathname, manager]);
  
  return {
    isSubscribed: subscriptionsByTable[tableName]?.length > 0
  };
}

/**
 * Hook for subscribing to multiple tables at once with automatic route registration
 */
export function useMultiTableSubscription(
  tables: Array<{
    table: string,
    queryKey?: string,
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    },
    priority?: 'high' | 'medium' | 'low'
  }>
) {
  const queryClient = useQueryClient();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const { subscriptionsByTable } = useSubscriptionContext();
  const location = useLocation();
  
  useEffect(() => {
    // Format tables array for the subscribeToTables method
    const tableConfigs = tables.map(t => ({
      table: t.table,
      queryKey: t.queryKey || t.table,
      filter: t.filter,
      priority: t.priority || 'medium'
    }));
    
    // Subscribe to all tables
    const subscription = manager.subscribeToTables(tableConfigs);
    
    // Register all subscriptions with the current route
    tables.forEach(t => {
      const actualQueryKey = t.queryKey || t.table;
      const subscriptionKey = `${t.table}::${typeof actualQueryKey === 'string' ? actualQueryKey : JSON.stringify(actualQueryKey)}`;
      manager.registerRouteSubscription(location.pathname, subscriptionKey);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [JSON.stringify(tables), location.pathname, manager]);
  
  return {
    isSubscribed: tables.every(t => subscriptionsByTable[t.table]?.length > 0)
  };
}

/**
 * Hook for subscribing to a specific row in a table with automatic route registration
 */
export function useRowSubscription(
  tableName: string,
  rowId: string,
  queryKey?: string | string[]
) {
  const actualQueryKey = queryKey || [tableName, rowId];
  const filter = { filter: `id=eq.${rowId}` };
  
  return useTableSubscription(tableName, actualQueryKey, filter);
}

/**
 * Hook for subscribing to related tables that should all invalidate the same query
 */
export function useRelatedTablesSubscription(
  primaryTable: string,
  relatedTables: string[],
  queryKey?: string | string[]
) {
  const actualQueryKey = queryKey || primaryTable;
  
  const tables = [
    { table: primaryTable, queryKey: actualQueryKey },
    ...relatedTables.map(table => ({ 
      table, 
      queryKey: actualQueryKey
    }))
  ];
  
  return useMultiTableSubscription(tables);
}
