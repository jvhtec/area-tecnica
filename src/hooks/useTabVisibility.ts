
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';

/**
 * Hook to refresh queries when tab becomes visible
 * @param queryKeys Array of query keys to invalidate when tab becomes visible
 * @param options Optional configuration
 */
export const useTabVisibility = (
  queryKeys: string[],
  options?: {
    minTimeBetweenRefreshes?: number;
  }
) => {
  const queryClient = useQueryClient();
  const { minTimeBetweenRefreshes = 5000 } = options || {};

  useEffect(() => {
    // Get the subscription manager instance
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Use the existing functionality in the subscription manager
    let lastRefreshTime = Date.now();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefreshTime >= minTimeBetweenRefreshes) {
          console.log('Tab became visible, refreshing data for:', queryKeys.join(', '));
          
          queryKeys.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
          
          lastRefreshTime = now;
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, queryKeys, minTimeBetweenRefreshes]);
};
