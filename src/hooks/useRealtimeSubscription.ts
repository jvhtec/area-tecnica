import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

type SubscriptionOptions = {
  table: string;
  schema?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  queryKey: string | string[];
};

/**
 * Subscribe to Supabase realtime changes through the unified manager.
 */
export function useRealtimeSubscription(options: SubscriptionOptions | SubscriptionOptions[]) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient],
  );
  const ownerIdRef = useRef(`realtime-hook-${Math.random().toString(36).slice(2)}`);
  const isSubscribedRef = useRef(false);

  const subscriptions = Array.isArray(options) ? options : [options];
  const serializedSubscriptions = useMemo(
    () => JSON.stringify(subscriptions),
    [subscriptions],
  );
  const stableSubscriptions = useMemo(() => subscriptions, [serializedSubscriptions]);

  useEffect(() => {
    const ownerRoute = `${location.pathname}:${ownerIdRef.current}`;

    stableSubscriptions.forEach((subscription) => {
      const { table, schema = "public", event = "*", filter, queryKey } = subscription;
      const normalizedQueryKey = Array.isArray(queryKey) ? queryKey : [queryKey];

      subscriptionManager.subscribeToTable(
        table,
        normalizedQueryKey,
        {
          event,
          schema,
          filter,
        },
        "medium",
        {
          ownerRoute,
          onPayload:
            table === "festival_artists"
              ? () => {
                  queryClient.refetchQueries({ queryKey: normalizedQueryKey });
                }
              : undefined,
        },
      );
    });

    isSubscribedRef.current = stableSubscriptions.length > 0;

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute);
      isSubscribedRef.current = false;
    };
  }, [location.pathname, stableSubscriptions, subscriptionManager, queryClient]);

  return {
    isSubscribed: isSubscribedRef.current,
  };
}
