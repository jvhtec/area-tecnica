import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

let tourRateSubscriptionInstance = 0;

/**
 * Hook for managing realtime subscriptions to tour rate related tables
 */
export const useTourRateSubscriptions = () => {
  const queryClient = useQueryClient();
  const instanceIdRef = useRef<string>();

  if (!instanceIdRef.current) {
    tourRateSubscriptionInstance += 1;
    instanceIdRef.current = String(tourRateSubscriptionInstance);
  }

  useEffect(() => {
    console.log('Setting up tour rates realtime subscriptions');

    let jobsChannel: ReturnType<typeof supabase.channel> | null = null;
    let assignmentsChannel: ReturnType<typeof supabase.channel> | null = null;
    let houseRatesChannel: ReturnType<typeof supabase.channel> | null = null;
    let extrasChannel: ReturnType<typeof supabase.channel> | null = null;
    const channelName = (baseName: string) => `${baseName}-${instanceIdRef.current}`;

    // Subscribe to job changes (start_time changes affect weekly calculations)
    jobsChannel = supabase
      .channel(channelName('tour-jobs-changes'))
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
    assignmentsChannel = supabase
      .channel(channelName('job-assignments-changes'))
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
    houseRatesChannel = supabase
      .channel(channelName('house-tech-rates-changes'))
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
    extrasChannel = supabase
      .channel(channelName('job-rate-extras-changes'))
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
      if (jobsChannel) supabase.removeChannel(jobsChannel);
      if (assignmentsChannel) supabase.removeChannel(assignmentsChannel);
      if (houseRatesChannel) supabase.removeChannel(houseRatesChannel);
      if (extrasChannel) supabase.removeChannel(extrasChannel);
    };
  }, [queryClient]);
};
