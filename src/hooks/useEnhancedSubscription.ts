
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedSubscriptionManager } from '@/lib/enhanced-subscription-manager';

/**
 * Hook for real-time table subscriptions with enhanced monitoring and recovery
 * @param table The table name to subscribe to
 * @param queryKey The query key to invalidate on changes
 * @returns Subscription status information
 */
export function useEnhancedSubscription(
  table: string,
  queryKey: string | string[]
) {
  const queryClient = useQueryClient();
  const manager = EnhancedSubscriptionManager.getInstance(queryClient);
  const normalizedQueryKey = typeof queryKey === 'string' ? queryKey : queryKey[0];
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [status, setStatus] = useState({
    isConnected: false,
    lastActivity: 0,
    errorCount: 0,
    status: 'connecting' as 'connecting' | 'connected' | 'disconnected' | 'error'
  });
  
  useEffect(() => {
    // Subscribe to the table
    subscriptionRef.current = manager.subscribeToTable(table, normalizedQueryKey);
    
    // Set up status monitoring interval
    const statusInterval = setInterval(() => {
      const currentStatus = manager.getSubscriptionStatus(table, normalizedQueryKey);
      setStatus(currentStatus);
    }, 5000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [table, normalizedQueryKey, manager]);
  
  // Function to manually reset the subscription
  const resetSubscription = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    subscriptionRef.current = manager.subscribeToTable(table, normalizedQueryKey);
    queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
  };
  
  return {
    ...status,
    resetSubscription,
    isStale: Date.now() - status.lastActivity > 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Hook for subscribing to multiple tables simultaneously
 * @param tables Array of tables and query keys to subscribe to
 * @returns Connection status information
 */
export function useMultiTableEnhancedSubscription(
  tables: Array<{ table: string, queryKey: string | string[] }>
) {
  const queryClient = useQueryClient();
  const manager = EnhancedSubscriptionManager.getInstance(queryClient);
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);
  const [statuses, setStatuses] = useState<Record<string, any>>({});
  
  useEffect(() => {
    // Clean up any existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];
    
    // Create new subscriptions
    tables.forEach(({ table, queryKey }) => {
      const normalizedQueryKey = typeof queryKey === 'string' ? queryKey : queryKey[0];
      const subscription = manager.subscribeToTable(table, normalizedQueryKey);
      subscriptionsRef.current.push(subscription);
    });
    
    // Set up status monitoring interval
    const statusInterval = setInterval(() => {
      const newStatuses: Record<string, any> = {};
      
      tables.forEach(({ table, queryKey }) => {
        const normalizedQueryKey = typeof queryKey === 'string' ? queryKey : queryKey[0];
        newStatuses[`${table}::${normalizedQueryKey}`] = 
          manager.getSubscriptionStatus(table, normalizedQueryKey);
      });
      
      setStatuses(newStatuses);
    }, 5000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [tables, manager]);
  
  // Determine overall connection status
  const isAllConnected = Object.values(statuses).every(status => status?.status === 'connected');
  const hasError = Object.values(statuses).some(status => status?.status === 'error');
  const isStale = Object.values(statuses).some(status => 
    Date.now() - (status?.lastActivity || 0) > 5 * 60 * 1000
  );
  
  // Function to reset all subscriptions
  const resetAllSubscriptions = () => {
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];
    
    tables.forEach(({ table, queryKey }) => {
      const normalizedQueryKey = typeof queryKey === 'string' ? queryKey : queryKey[0];
      const subscription = manager.subscribeToTable(table, normalizedQueryKey);
      subscriptionsRef.current.push(subscription);
      
      // Invalidate the queries
      queryClient.invalidateQueries({ 
        queryKey: Array.isArray(queryKey) ? queryKey : [queryKey]
      });
    });
  };
  
  return {
    isConnected: isAllConnected,
    hasError,
    isStale,
    tableStatuses: statuses,
    resetAllSubscriptions
  };
}
