
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
