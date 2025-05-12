
import { useEffect, useRef } from "react";
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
  
  // Normalize options to array and ensure it's valid
  const subscriptions = Array.isArray(options) ? options : (options ? [options] : []);
  
  useEffect(() => {
    // Return early if we don't have subscriptions or supabase
    if (!subscriptions || subscriptions.length === 0 || !supabase) {
      console.log('No subscriptions or supabase client unavailable');
      return;
    }
    
    // Store current subscriptions for reconnect event
    subscriptionsRef.current = subscriptions;
    
    // Create a unique channel name based on the subscribed tables
    const tables = subscriptions.map(sub => sub.table).join("-");
    const channelName = `${tables}-${Math.random().toString(36).substring(2, 10)}`;
    
    console.log(`Creating channel ${channelName} for tables: ${tables}`);
    
    try {
      // Create the channel
      const channel = supabase.channel(channelName);
      channelRef.current = channel;
      
      // Add subscriptions to the channel
      subscriptions.forEach(sub => {
        if (!sub || !sub.table) return;
        
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
        
        try {
          // Subscribe to the table
          channel.on(
            "postgres_changes",
            config,
            (payload) => {
              console.log(`Received ${payload.eventType} for ${table}:`, payload);
              
              // Invalidate related queries
              if (Array.isArray(queryKey)) {
                queryClient.invalidateQueries({ queryKey });
              } else {
                queryClient.invalidateQueries({ queryKey: [queryKey] });
              }
            }
          );
        } catch (error) {
          console.error(`Error setting up subscription for ${table}:`, error);
        }
      });
      
      // Handle connection status
      let hasConnected = false;
      
      try {
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
      } catch (subscribeError) {
        console.error(`Error subscribing to channel:`, subscribeError);
      }
      
      // Listen for reconnect events
      const handleReconnect = () => {
        if (channelRef.current && supabase) {
          console.log(`Reconnecting channel ${channelName}`);
          
          // Remove the old channel
          try {
            supabase.removeChannel(channelRef.current);
          } catch (e) {
            console.error("Error removing channel during reconnect:", e);
          }
          
          // Create a new channel with the same configuration
          try {
            const newChannel = supabase.channel(`${channelName}-reconnect`);
            channelRef.current = newChannel;
            
            // Re-add all subscriptions
            subscriptionsRef.current.forEach(sub => {
              if (!sub || !sub.table) return;
              
              const { table, schema = "public", event = "*", filter, queryKey } = sub;
              
              const config: any = { event, schema, table };
              if (filter) config.filter = filter;
              
              newChannel.on("postgres_changes", config, (payload) => {
                console.log(`Received ${payload.eventType} for ${table} (reconnected):`, payload);
                
                if (Array.isArray(queryKey)) {
                  queryClient.invalidateQueries({ queryKey });
                } else {
                  queryClient.invalidateQueries({ queryKey: [queryKey] });
                }
              });
            });
            
            // Subscribe to the new channel
            newChannel.subscribe((status) => {
              console.log(`Reconnected channel status:`, status);
            });
            
            // Refresh data
            subscriptionsRef.current.forEach(sub => {
              if (!sub || !sub.queryKey) return;
              
              const { queryKey } = sub;
              if (Array.isArray(queryKey)) {
                queryClient.invalidateQueries({ queryKey });
              } else {
                queryClient.invalidateQueries({ queryKey: [queryKey] });
              }
            });
          } catch (error) {
            console.error("Error creating new channel during reconnect:", error);
          }
        }
      };
      
      window.addEventListener('supabase-reconnect', handleReconnect);
      
      // Cleanup function
      return () => {
        window.removeEventListener('supabase-reconnect', handleReconnect);
        
        if (channelRef.current && supabase) {
          try {
            console.log(`Removing channel ${channelName}`);
            supabase.removeChannel(channelRef.current);
          } catch (e) {
            console.error("Error removing channel during cleanup:", e);
          }
          channelRef.current = null;
        }
      };
    } catch (error) {
      console.error("Error in useRealtimeSubscription:", error);
      return () => {};
    }
  }, [JSON.stringify(subscriptions), queryClient, toast]);
  
  return {
    isSubscribed: !!channelRef.current
  };
}
