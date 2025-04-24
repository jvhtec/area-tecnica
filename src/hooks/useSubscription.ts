
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';

export function useTableSubscription(
  table: string,
  queryKey: string | string[]
) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  
  useEffect(() => {
    const manager = SubscriptionManager.getInstance(queryClient);
    subscriptionRef.current = manager.subscribeToTable(table, queryKey);
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [table, queryKey, queryClient]);
}

// Add the missing function that's being imported in other files
export function useMultiTableSubscription(
  tables: Array<{ table: string, queryKey?: string }>
) {
  const queryClient = useQueryClient();
  const subscriptionRefs = useRef<Array<{ unsubscribe: () => void }>>([]);
  
  useEffect(() => {
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Clear any existing subscriptions
    subscriptionRefs.current.forEach(sub => sub.unsubscribe());
    subscriptionRefs.current = [];
    
    // Create new subscriptions for each table
    tables.forEach(({ table, queryKey }) => {
      const subscription = manager.subscribeToTable(table, queryKey || table);
      subscriptionRefs.current.push(subscription);
    });
    
    // Clean up on unmount
    return () => {
      subscriptionRefs.current.forEach(sub => sub.unsubscribe());
      subscriptionRefs.current = [];
    };
  }, [tables, queryClient]);
}
