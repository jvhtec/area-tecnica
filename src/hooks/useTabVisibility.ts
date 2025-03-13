
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to refresh queries when tab becomes visible
 * @param queryKeys Array of query keys to invalidate when tab becomes visible
 */
export const useTabVisibility = (queryKeys: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab is now visible, refreshing data for:', queryKeys);
        // Invalidate all specified queries when tab becomes visible
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up the event listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, queryKeys]);
};
