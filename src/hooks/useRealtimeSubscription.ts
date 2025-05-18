
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeSubscription(table: string, queryKey?: any) {
  useEffect(() => {
    // Set up a Supabase realtime subscription
    const channel = supabase
      .channel(`public:${table}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table 
      }, (payload) => {
        console.log('Realtime update:', payload);
      })
      .subscribe();

    // Clean up subscription when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryKey]);
}
