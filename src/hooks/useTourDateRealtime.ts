
import React from "react";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook for real-time updates to tour date management
 * Subscribes to changes in tour_dates, flex_folders, and locations tables
 */
export const useTourDateRealtime = (tourId: string | null, tourDateIds: string[]) => {
  const queryClient = useQueryClient();

  // Subscribe to tour dates changes - matches parent component query key
  useRealtimeSubscription({
    table: 'tour_dates',
    queryKey: ['tour', tourId],
    event: '*',
    filter: tourId ? `tour_id=eq.${tourId}` : undefined,
  });

  // Subscribe to flex folders changes for the specific tour dates
  useRealtimeSubscription({
    table: 'flex_folders', 
    queryKey: ['flex-folders-existence', ...tourDateIds],
    event: '*',
  });

  // Subscribe to locations changes - also matches parent component query key
  useRealtimeSubscription({
    table: 'locations',
    queryKey: ['tour', tourId],
    event: '*',
  });

  // Force refresh queries when tour dates change
  React.useEffect(() => {
    if (tourId) {
      console.log('Setting up additional query invalidation for tour:', tourId);
      
      // Force invalidate queries periodically to ensure UI stays in sync
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['tour', tourId] });
      }, 2000); // Check every 2 seconds

      return () => clearInterval(interval);
    }
  }, [tourId, queryClient]);
};
