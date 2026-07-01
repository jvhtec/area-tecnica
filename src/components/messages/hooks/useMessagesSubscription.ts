
import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager, type RealtimeChangePayload } from '@/lib/unified-subscription-manager';

export const useMessagesSubscription = (
  currentUserId: string | undefined,
  onUpdate: () => void
) => {
  const queryClient = useQueryClient();
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  );
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const ownerIdRef = useRef(`direct-messages-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!currentUserId) return;

    const ownerRoute = ownerIdRef.current;

    subscriptionManager.subscribeToTable(
      'direct_messages',
      ['direct-messages', currentUserId],
      { event: '*', schema: 'public' },
      'medium',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload: RealtimeChangePayload) => {
          const record = payload.new as { sender_id?: string; recipient_id?: string } | null;
          if (record && (record.sender_id === currentUserId || record.recipient_id === currentUserId)) {
            onUpdateRef.current();
          }
        },
      }
    );

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute);
    };
  }, [currentUserId, subscriptionManager]);
};
