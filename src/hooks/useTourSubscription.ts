
import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';


import { queryKeys } from "@/lib/react-query";
/**
 * Hook for managing realtime subscriptions to the tours table
 */
export const useTourSubscription = () => {
  const queryClient = useQueryClient();
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  );
  const ownerIdRef = useRef(`tour-subscription-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const ownerRoute = ownerIdRef.current;

    subscriptionManager.subscribeToTable(
      'tours',
      queryKeys.scope('tours'),
      { event: '*', schema: 'public' },
      'medium',
      { ownerRoute }
    );

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute);
    };
  }, [subscriptionManager]);
};
