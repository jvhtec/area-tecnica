
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useLocation } from 'react-router-dom';

/**
 * Hook for subscribing to Supabase real-time updates for a specific table
 * with automatic route registration and cleanup.
 * 
 * @param table The table to subscribe to
 * @param queryKey The query key to invalidate on changes
 * @param filter Optional filter for the subscription
 * @param priority Priority of the subscription
 * @returns Subscription status information
 */
export function useTableSubscription(
  table: string,
  queryKey: string | string[],
  filter?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    schema?: string,
    filter?: string
  },
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  const queryClient = useQueryClient();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const location = useLocation();
  
  useEffect(() => {
    console.log(`Setting up subscription to ${table} (${priority} priority)`);
    
    // Subscribe to the table
    const subscription = manager.subscribeToTable(table, queryKey, filter, priority);
    
    // Register this subscription with the current route
    const subscriptionKey = Array.isArray(queryKey) 
      ? `${table}::${JSON.stringify(queryKey)}`
      : `${table}::${queryKey}`;
    
    manager.registerRouteSubscription(location.pathname, subscriptionKey);
    
    // Cleanup on unmount
    return () => {
      // Note: actual unsubscription will be handled by the manager based on route usage
      console.log(`Component using ${table} subscription unmounted`);
    };
  }, [table, JSON.stringify(queryKey), JSON.stringify(filter), priority, location.pathname, manager]);
  
  // Get subscription status
  const status = manager.getSubscriptionStatus(table, queryKey);
  
  return {
    isSubscribed: status.isConnected,
    lastActivity: status.lastActivity,
    isStale: Date.now() - status.lastActivity > 5 * 60 * 1000 // 5 minutes
  };
}

/**
 * Hook for subscribing to multiple tables at once
 * with automatic route registration and cleanup.
 */
export function useMultiTableSubscription(
  tables: Array<{
    table: string,
    queryKey: string | string[],
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
  const location = useLocation();
  
  useEffect(() => {
    console.log(`Setting up subscription to multiple tables: ${tables.map(t => t.table).join(', ')}`);
    
    // Subscribe to all tables
    const subscription = manager.subscribeToTables(tables);
    
    // Register all subscriptions with current route
    tables.forEach(({ table, queryKey }) => {
      const subscriptionKey = Array.isArray(queryKey) 
        ? `${table}::${JSON.stringify(queryKey)}`
        : `${table}::${queryKey}`;
      
      manager.registerRouteSubscription(location.pathname, subscriptionKey);
    });
    
    // Cleanup on unmount
    return () => {
      // Note: actual unsubscription will be handled by the manager based on route usage
      console.log(`Component using multiple table subscriptions unmounted`);
    };
  }, [JSON.stringify(tables), location.pathname, manager]);
  
  // Get subscription statuses
  const statuses = tables.map(({ table, queryKey }) => {
    const status = manager.getSubscriptionStatus(table, queryKey);
    return {
      table,
      queryKey,
      isSubscribed: status.isConnected,
      lastActivity: status.lastActivity,
      isStale: Date.now() - status.lastActivity > 5 * 60 * 1000
    };
  });
  
  // Aggregate status
  const isAllSubscribed = statuses.every(s => s.isSubscribed);
  const isAnyStale = statuses.some(s => s.isStale);
  
  return {
    isSubscribed: isAllSubscribed,
    isStale: isAnyStale,
    tableStatuses: statuses,
    refreshSubscriptions: () => {
      manager.forceRefreshSubscriptions(tables.map(t => t.table));
      queryClient.invalidateQueries();
    }
  };
}

/**
 * Hook for subscribing to a specific row in a table
 */
export function useRowSubscription(
  table: string,
  rowId: string,
  queryKey: string | string[]
) {
  return useTableSubscription(
    table,
    queryKey,
    { filter: `id=eq.${rowId}` }
  );
}
