import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';


import { queryKeys } from "@/lib/react-query";

type TourRateChannel = ReturnType<typeof supabase.channel>;

const channelNames = [
  'tour-jobs-changes',
  'job-assignments-changes',
  'house-tech-rates-changes',
  'job-rate-extras-changes',
] as const;

const queryClientRefCounts = new Map<QueryClient, number>();
let channels: TourRateChannel[] = [];
let setupPromise: Promise<void> | null = null;

const invalidateTourRateQueries = () => {
  for (const queryClient of queryClientRefCounts.keys()) {
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-job-rate-quotes') });
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('technician-tour-rate-quotes') });
  }
};

const invalidateExtrasQueries = () => {
  for (const queryClient of queryClientRefCounts.keys()) {
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-extras') });
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-tech-payout') });
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('my-job-payout-totals') });
  }
};

const removeExistingTourRateChannels = async () => {
  const topics = new Set(channelNames.map((name) => `realtime:${name}`));
  const existingChannels = typeof supabase.getChannels === 'function'
    ? supabase.getChannels().filter((channel) => topics.has(channel.topic))
    : [];

  await Promise.all(existingChannels.map((channel) => supabase.removeChannel(channel)));
};

const setupTourRateSubscriptions = async () => {
  if (channels.length > 0) return;
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    await removeExistingTourRateChannels();
    if (queryClientRefCounts.size === 0 || channels.length > 0) return;

    console.log('Setting up tour rates realtime subscriptions');

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
          invalidateTourRateQueries();
        }
      )
      .subscribe();

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
          invalidateTourRateQueries();
        }
      )
      .subscribe();

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
          invalidateTourRateQueries();
        }
      )
      .subscribe();

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
          invalidateTourRateQueries();
          invalidateExtrasQueries();
        }
      )
      .subscribe();

    channels = [jobsChannel, assignmentsChannel, houseRatesChannel, extrasChannel];
  })().finally(() => {
    setupPromise = null;
  });

  return setupPromise;
};

const teardownTourRateSubscriptions = () => {
  if (queryClientRefCounts.size > 0 || channels.length === 0) return;

  console.log('Cleaning up tour rates subscriptions');
  const channelsToRemove = channels;
  channels = [];
  void Promise.all(channelsToRemove.map((channel) => supabase.removeChannel(channel))).catch((error) => {
    console.warn('Failed to clean up tour rates subscriptions', error);
  });
};

export const resetTourRateSubscriptionsForTests = () => {
  queryClientRefCounts.clear();
  channels = [];
  setupPromise = null;
};

/**
 * Hook for managing realtime subscriptions to tour rate related tables
 */
export const useTourRateSubscriptions = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClientRefCounts.set(queryClient, (queryClientRefCounts.get(queryClient) ?? 0) + 1);
    void setupTourRateSubscriptions();

    return () => {
      const refCount = queryClientRefCounts.get(queryClient) ?? 0;
      if (refCount <= 1) {
        queryClientRefCounts.delete(queryClient);
      } else {
        queryClientRefCounts.set(queryClient, refCount - 1);
      }
      teardownTourRateSubscriptions();
    };
  }, [queryClient]);
};
