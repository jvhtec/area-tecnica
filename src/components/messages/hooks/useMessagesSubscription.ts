import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useMessagesSubscription = (
  currentUserId: string | undefined,
  onUpdate: () => void
) => {
  useEffect(() => {
    if (!currentUserId) return;

    console.log('Setting up direct messages subscription for user:', currentUserId);

    const channel = supabase
      .channel('direct-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload: { new: any; eventType: string; old: any }) => {
          console.log('Received direct message change:', payload);
          
          if (payload.new && 
              (payload.new.sender_id === currentUserId || 
               payload.new.recipient_id === currentUserId)) {
            onUpdate();
          }
        }
      )
      .subscribe((status) => {
        console.log('Direct messages subscription status:', status);
      });

    return () => {
      console.log('Cleaning up direct messages subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId, onUpdate]);
};