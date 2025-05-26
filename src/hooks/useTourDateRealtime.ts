
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

/**
 * Hook for real-time updates to tour date management
 * Subscribes to changes in tour_dates, flex_folders, and locations tables
 */
export const useTourDateRealtime = (tourId: string | null, tourDateIds: string[]) => {
  // Subscribe to tour dates changes - matches parent component query key
  useRealtimeSubscription({
    table: 'tour_dates',
    queryKey: ['tour', tourId], // Changed from 'tours' to 'tour' to match TourManagementWrapper
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
    queryKey: ['tour', tourId], // Changed from 'tours' to 'tour' to match TourManagementWrapper
    event: '*',
  });
};
