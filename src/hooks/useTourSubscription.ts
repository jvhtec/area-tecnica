
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Hook for managing realtime subscriptions to the tours table
 */
export const useTourSubscription = () => {
  const queryClient = useQueryClient();
  
  // Temporarily disabled to reduce database load during connectivity issues
  console.log('Tour subscriptions temporarily disabled due to database connectivity issues');
  
  /*
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
          
          // Invalidate optimized tours query to refresh the data
          queryClient.invalidateQueries({ queryKey: ['tours-optimized'] });
          queryClient.invalidateQueries({ queryKey: ['tour-dates-batch'] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tours subscription');
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  */
};
