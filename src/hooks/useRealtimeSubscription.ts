
import { useEffect, useRef } from 'react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface SubscriptionOptions {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
}

export function useRealtimeSubscription(
  table: string,
  queryKey: string | string[],
  options: SubscriptionOptions = { event: '*', schema: 'public' }
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create a unique channel name
    const channelName = `${table}-${Array.isArray(queryKey) ? queryKey.join('-') : queryKey}-${Date.now()}`;
    
    console.log(`Setting up realtime subscription for ${table}`);
    
    // Create the channel
    const channel = supabase.channel(channelName);
    
    // Add the subscription to postgres changes
    channel.on(
      'postgres_changes', 
      { 
        event: options.event, 
        schema: options.schema, 
        table: table,
        filter: options.filter
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log(`Received realtime update for ${table}:`, payload);
        
        // Invalidate queries
        if (Array.isArray(queryKey)) {
          queryClient.invalidateQueries({ queryKey });
        } else {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }
      }
    )
    .subscribe((status) => {
      console.log(`Subscription status for ${table}:`, status);
    });

    // Store the channel reference
    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log(`Cleaning up realtime subscription for ${table}`);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, queryKey, options.event, options.schema, options.filter, queryClient]);

  return {
    isSubscribed: !!channelRef.current
  };
}
