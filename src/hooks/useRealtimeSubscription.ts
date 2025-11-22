
import { useEffect, useMemo, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/enhanced-supabase-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type SubscriptionOptions = {
  table: string;
  schema?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  queryKey: string | string[];
};

/**
 * A React hook for subscribing to Supabase real-time changes with enhanced reliability
 */
export function useRealtimeSubscription(options: SubscriptionOptions | SubscriptionOptions[]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscriptionsRef = useRef<SubscriptionOptions[]>([]);
  
  // Normalize options to array
  const subscriptions = Array.isArray(options) ? options : [options];
  const serializedSubscriptions = useMemo(
    () => JSON.stringify(subscriptions),
    [subscriptions]
  );
  const stableSubscriptions = useMemo(() => subscriptions, [serializedSubscriptions]);
  
  useEffect(() => {
    // Store current subscriptions for reconnect event
    subscriptionsRef.current = stableSubscriptions;
    
    // Create a unique channel name based on the subscribed tables
    const tables = stableSubscriptions.map(sub => sub.table).join("-");
    const channelName = `${tables}-${Math.random().toString(36).substring(2, 10)}`;
    
    console.log(`Creating channel ${channelName} for tables: ${tables}`);
    
    // Create the channel
    const channel = supabase.channel(channelName);
    channelRef.current = channel;
    
    // Add subscriptions to the channel
    stableSubscriptions.forEach(sub => {
      const { table, schema = "public", event = "*", filter, queryKey } = sub;
      
      // Configure the subscription
      const config: any = {
        event,
        schema,
        table
      };
      
      // Add filter if provided
      if (filter) {
        config.filter = filter;
      }
      
      // Subscribe to the table
      channel.on(
        "postgres_changes",
        config,
        (payload) => {
          console.log(`Received ${payload.eventType} for ${table}:`, payload);
          
          // Invalidate related queries immediately for faster UI updates
          if (Array.isArray(queryKey)) {
            queryClient.invalidateQueries({ queryKey });
          } else {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
          }
          
          // For artist table specifically, also refetch immediately
          if (table === 'festival_artists') {
            if (Array.isArray(queryKey)) {
              queryClient.refetchQueries({ queryKey });
            } else {
              queryClient.refetchQueries({ queryKey: [queryKey] });
            }
          }
        }
      );
    });
    
    // Handle connection status
    let hasConnected = false;
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log(`Channel ${channelName} status:`, status);
      
      if (status === "SUBSCRIBED") {
        // Mark as connected
        hasConnected = true;
      } else if (status === "CHANNEL_ERROR" && hasConnected) {
        // Only show error if we were previously connected (to avoid startup errors)
        console.error(`Error in channel ${channelName}`);
        toast({
          title: "Connection issue",
          description: "Real-time updates may be delayed",
          variant: "destructive",
        });
      }
    });
    
    // Listen for reconnect events
    const handleReconnect = () => {
      if (channelRef.current) {
        console.log(`Reconnecting channel ${channelName}`);
        
        // Remove the old channel
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.error("Error removing channel during reconnect:", e);
        }
        
        // Create a new channel with the same configuration
        const newChannel = supabase.channel(`${channelName}-reconnect`);
        channelRef.current = newChannel;
        
        // Re-add all subscriptions
        subscriptionsRef.current.forEach(sub => {
          const { table, schema = "public", event = "*", filter, queryKey } = sub;
          
          const config: any = { event, schema, table };
          if (filter) config.filter = filter;
          
          newChannel.on("postgres_changes", config, (payload) => {
            console.log(`Received ${payload.eventType} for ${table} (reconnected):`, payload);
            
            if (Array.isArray(queryKey)) {
              queryClient.invalidateQueries({ queryKey });
              queryClient.refetchQueries({ queryKey });
            } else {
              queryClient.invalidateQueries({ queryKey: [queryKey] });
              queryClient.refetchQueries({ queryKey: [queryKey] });
            }
          });
        });
        
        // Subscribe to the new channel
        newChannel.subscribe((status) => {
          console.log(`Reconnected channel status:`, status);
        });
        
        // Refresh data
        subscriptionsRef.current.forEach(sub => {
          const { queryKey } = sub;
          if (Array.isArray(queryKey)) {
            queryClient.invalidateQueries({ queryKey });
          } else {
            queryClient.invalidateQueries({ queryKey: [queryKey] });
          }
        });
      }
    };
    
    window.addEventListener('supabase-reconnect', handleReconnect);
    
    // Cleanup function
    return () => {
      window.removeEventListener('supabase-reconnect', handleReconnect);
      
      if (channelRef.current) {
        try {
          console.log(`Removing channel ${channelName}`);
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.error("Error removing channel during cleanup:", e);
        }
        channelRef.current = null;
      }
    };
  }, [serializedSubscriptions, stableSubscriptions, queryClient, toast]);
  
  return {
    isSubscribed: !!channelRef.current
  };
}
