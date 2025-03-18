
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';

/**
 * Hook for subscribing to Supabase real-time updates for a specific table
 * @param table The table name to subscribe to
 * @param queryKey The query key or array of keys to invalidate when the table changes
 * @param filter Optional filter conditions for the subscription
 */
export function useTableSubscription(
  table: string,
  queryKey: string | string[],
  filter?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    schema?: string,
    filter?: string
  }
) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  
  useEffect(() => {
    // Get the subscription manager instance
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Subscribe to the table
    subscriptionRef.current = manager.subscribeToTable(table, queryKey, filter);
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [table, queryKey, filter, queryClient]);
}

/**
 * Hook for subscribing to multiple tables at once
 * @param tables Array of table names and query keys
 */
export function useMultiTableSubscription(
  tables: Array<{ 
    table: string, 
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    }
  }>
) {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  
  useEffect(() => {
    // Get the subscription manager instance
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Create an array of subscriptions
    const subscriptions = tables.map(({ table, queryKey, filter }) => ({
      table,
      queryKey,
      subscription: manager.subscribeToTable(table, queryKey, filter)
    }));
    
    // Store unsubscribe function
    subscriptionRef.current = {
      unsubscribe: () => {
        subscriptions.forEach(({ subscription }) => subscription.unsubscribe());
      }
    };
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [tables, queryClient]);
}

/**
 * Hook for subscribing to a specific row in a table
 * @param table The table name to subscribe to
 * @param rowId The ID of the row to subscribe to
 * @param queryKey The query key or array of keys to invalidate when the row changes
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
