
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type SubscriptionConfig = {
  table: string;
  filter?: string;
  queryKey?: any;
};

/**
 * Hook for setting up Supabase realtime subscriptions
 * @param tableOrConfig Single table name as string or subscription config object or array of configs
 * @param queryKey Optional query key to invalidate (when using simple string table parameter)
 */
export function useRealtimeSubscription(
  tableOrConfig: string | SubscriptionConfig | SubscriptionConfig[],
  queryKey?: any
) {
  useEffect(() => {
    let channels: any[] = [];

    const setupSubscription = (table: string, filter?: string) => {
      // Set up a Supabase realtime subscription
      const channelConfig: any = {
        event: '*', 
        schema: 'public', 
        table 
      };
      
      // Add filter if provided
      if (filter) {
        channelConfig.filter = filter;
      }
      
      const channel = supabase
        .channel(`public:${table}:${Date.now()}`)
        .on('postgres_changes', channelConfig, (payload) => {
          console.log('Realtime update:', payload);
        })
        .subscribe();
        
      return channel;
    };

    // Handle different parameter types
    if (typeof tableOrConfig === 'string') {
      // Simple case: just a table name
      channels.push(setupSubscription(tableOrConfig));
    } else if (Array.isArray(tableOrConfig)) {
      // Array of configs
      tableOrConfig.forEach(config => {
        channels.push(setupSubscription(config.table, config.filter));
      });
    } else {
      // Single config object
      channels.push(setupSubscription(tableOrConfig.table, tableOrConfig.filter));
    }

    // Clean up subscriptions when component unmounts
    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [tableOrConfig, queryKey]);
}
