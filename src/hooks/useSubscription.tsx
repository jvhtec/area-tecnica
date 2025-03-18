
import { useContext } from 'react';
import { useSubscriptionContext } from '@/providers/SubscriptionProvider';

/**
 * Hook for accessing subscription context information
 */
export function useSubscription() {
  return useSubscriptionContext();
}

export { useTableSubscription, useMultiTableSubscription, useRowSubscription, useRelatedTablesSubscription } from '@/hooks/useSubscription.ts';
