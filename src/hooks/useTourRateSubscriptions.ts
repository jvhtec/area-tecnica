import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for managing realtime subscriptions to tour rate related tables
 */
export const useTourRateSubscriptions = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('Setting up tour rates realtime subscriptions');
    
    // Subscribe to job changes (start_time changes affect weekly calculations)
    const jobsChannel = supabase
      .channel('tour-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: 'job_type=eq.tourdate'
        },
        (payload) => {
          console.log('Tour job change detected:', payload);
          
          // Invalidate all tour rate queries
          queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
          queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
        }
      )
      .subscribe();

    // Subscribe to job assignment changes
    const assignmentsChannel = supabase
      .channel('job-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        (payload) => {
          console.log('Job assignment change detected:', payload);
          
          // Invalidate tour rate queries
          queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
          queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
        }
      )
      .subscribe();

    // Subscribe to house tech rates changes
    const houseRatesChannel = supabase
      .channel('house-tech-rates-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_tech_rates'
        },
        (payload) => {
          console.log('House tech rates change detected:', payload);
          
          // Invalidate tour rate queries
          queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
          queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
        }
      )
      .subscribe();

    // Subscribe to job rate extras changes
    const extrasChannel = supabase
      .channel('job-rate-extras-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_rate_extras'
        },
        (payload) => {
          console.log('Job rate extras change detected:', payload);
          
          // Invalidate tour rate and payout queries
          queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
          queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
          queryClient.invalidateQueries({ queryKey: ['job-extras'] });
          queryClient.invalidateQueries({ queryKey: ['job-tech-payout'] });
          queryClient.invalidateQueries({ queryKey: ['my-job-payout-totals'] });
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up tour rates subscriptions');
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(assignmentsChannel);
      supabase.removeChannel(houseRatesChannel);
      supabase.removeChannel(extrasChannel);
    };
  }, [queryClient]);
};