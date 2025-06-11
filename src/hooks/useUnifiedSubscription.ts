
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useLocation } from 'react-router-dom';

/**
 * Hook for subscribing to Supabase real-time updates for a specific table
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
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const location = useLocation();
  
  useEffect(() => {
    // Subscribe to the table
    subscriptionRef.current = manager.subscribeToTable(table, queryKey, filter, priority);
    
    // Register this subscription with the current route
    const subscriptionKey = Array.isArray(queryKey) 
      ? `${table}::${JSON.stringify(queryKey)}`
      : `${table}::${queryKey}`;
      
    manager.registerRouteSubscription(location.pathname, subscriptionKey);
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [table, JSON.stringify(queryKey), JSON.stringify(filter), priority, location.pathname, manager]);

  // Get subscription status
  const [status, setStatus] = useState({
    isConnected: false,
    lastActivity: 0,
    isStale: false
  });
  
  // Update status periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      const subscriptionStatus = manager.getSubscriptionStatus(table, queryKey);
      setStatus({
        isConnected: subscriptionStatus.isConnected,
        lastActivity: subscriptionStatus.lastActivity,
        isStale: Date.now() - subscriptionStatus.lastActivity > 5 * 60 * 1000 // 5 minutes
      });
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [table, JSON.stringify(queryKey), manager]);
  
  return {
    isSubscribed: status.isConnected,
    isStale: status.isStale,
    lastActivity: status.lastActivity
  };
}

/**
 * Hook for subscribing to multiple tables at once
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
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const location = useLocation();
  
  useEffect(() => {
    // Create subscription to multiple tables
    subscriptionRef.current = manager.subscribeToTables(tables);
    
    // Register all subscriptions with current route
    tables.forEach(({ table, queryKey }) => {
      const subscriptionKey = Array.isArray(queryKey) 
        ? `${table}::${JSON.stringify(queryKey)}`
        : `${table}::${queryKey}`;
        
      manager.registerRouteSubscription(location.pathname, subscriptionKey);
    });
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [JSON.stringify(tables), location.pathname, manager]);
  
  // Get subscription status for all tables
  const [statuses, setStatuses] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const intervalId = setInterval(() => {
      const newStatuses: Record<string, any> = {};
      
      tables.forEach(({ table, queryKey }) => {
        const subscriptionStatus = manager.getSubscriptionStatus(table, queryKey);
        const key = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
        
        newStatuses[`${table}::${key}`] = {
          isConnected: subscriptionStatus.isConnected,
          lastActivity: subscriptionStatus.lastActivity,
          isStale: Date.now() - subscriptionStatus.lastActivity > 5 * 60 * 1000
        };
      });
      
      setStatuses(newStatuses);
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [JSON.stringify(tables), manager]);
  
  // Determine overall status
  const allConnected = Object.values(statuses).every(status => status?.isConnected);
  const anyStale = Object.values(statuses).some(status => status?.isStale);
  
  return {
    isSubscribed: allConnected,
    isStale: anyStale,
    statuses
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
    {
      filter: `id=eq.${rowId}`
    }
  );
}

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
