
import React from "react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";


import { queryKeys } from "@/lib/react-query";
/**
 * Hook for real-time updates to tour date management
 * Subscribes to changes in tour_dates, flex_folders, and locations tables
 */
export const useTourDateRealtime = (tourId: string | null, tourDateIds: string[]) => {
  const tourDateIdsKey = React.useMemo(() => [...tourDateIds].sort().join(','), [tourDateIds]);

  // Subscribe to tour dates changes - matches parent component query key
  useRealtimeSubscription({
    table: 'tour_dates',
    queryKey: queryKeys.scope('tour', tourId),
    event: '*',
    filter: tourId ? `tour_id=eq.${tourId}` : undefined,
  });

  // Subscribe to flex folders changes for the specific tour dates
  useRealtimeSubscription({
    table: 'flex_folders', 
    queryKey: queryKeys.scope('flex-folders-existence', ...tourDateIds),
    event: '*',
  });

  // Subscribe to locations changes - also matches parent component query key
  useRealtimeSubscription({
    table: 'locations',
    queryKey: queryKeys.scope('tour', tourId),
    event: '*',
  });

  React.useEffect(() => {
    if (tourId) {
      console.log('Tour date realtime subscriptions active for tour:', tourId);
    }
  }, [tourId]);
};
