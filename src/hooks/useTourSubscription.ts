
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';


import { queryKeys } from "@/lib/react-query";
/**
 * Hook for managing realtime subscriptions to the tours table
 */
export const useTourSubscription = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('Setting up tours realtime subscription');
    
    const channel = supabase
      .channel('tours-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tours'
        },
        (payload) => {
          console.log('Tours table change detected:', payload);
          
          // Invalidate tours query to refresh the data
          queryClient.invalidateQueries({ queryKey: queryKeys.scope('tours') });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tours subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
