
import { useContext } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';

/**
 * Hook for accessing subscription context information
 */
export function useSubscription() {
  return useSubscriptionContext();
}

// Create individual hooks for different subscription types
export function useTableSubscription(tableName: string, queryKey?: string) {
  const { subscriptionsByTable } = useSubscriptionContext();
  const manager = SubscriptionManager.getInstance(queryClient);
  
  useEffect(() => {
    const subscription = manager.subscribeToTable(tableName, queryKey || tableName);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [tableName, queryKey, manager]);
  
  return {
    isSubscribed: subscriptionsByTable[tableName]?.length > 0
  };
}

export function useMultiTableSubscription(tables: Array<{table: string, queryKey?: string}>) {
  const { subscriptionsByTable } = useSubscriptionContext();
  const manager = SubscriptionManager.getInstance(queryClient);
  
  useEffect(() => {
    const subscription = manager.subscribeToTables(
      tables.map(t => ({ 
        table: t.table, 
        queryKey: t.queryKey || t.table 
      }))
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [tables, manager]);
  
  return {
    isSubscribed: tables.every(t => subscriptionsByTable[t.table]?.length > 0)
  };
}

export function useRowSubscription(tableName: string, rowId: string) {
  const { subscriptionsByTable } = useSubscriptionContext();
  const manager = SubscriptionManager.getInstance(queryClient);
  
  useEffect(() => {
    const filter = `id=eq.${rowId}`;
    const subscription = manager.subscribeToTable(
      tableName, 
      [tableName, rowId],
      { filter }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [tableName, rowId, manager]);
  
  return {
    isSubscribed: subscriptionsByTable[tableName]?.some(key => key.includes(rowId))
  };
}

export function useRelatedTablesSubscription(
  primaryTable: string, 
  relatedTables: string[]
) {
  const { subscriptionsByTable } = useSubscriptionContext();
  const manager = SubscriptionManager.getInstance(queryClient);
  
  useEffect(() => {
    const tables = [
      { table: primaryTable, queryKey: primaryTable },
      ...relatedTables.map(table => ({ table, queryKey: [primaryTable, table] }))
    ];
    
    const subscription = manager.subscribeToTables(tables);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [primaryTable, relatedTables, manager]);
  
  return {
    isSubscribed: [primaryTable, ...relatedTables].every(
      table => subscriptionsByTable[table]?.length > 0
    )
  };
}

// Import necessary dependencies
import { useEffect } from 'react';
import { queryClient } from '@/lib/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';
