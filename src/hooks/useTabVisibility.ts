
import { useEffect } from 'react';
import { QueryKey, useQueryClient } from '@tanstack/react-query';

/**
 * Hook to refresh queries when tab becomes visible
 * @param queryKeys Array of query keys to invalidate when tab becomes visible
 * @param options Optional configuration
 */
export const useTabVisibility = (
  queryKeys: QueryKey[],
  options?: {
    minTimeBetweenRefreshes?: number;
  }
) => {
  const queryClient = useQueryClient();
  const { minTimeBetweenRefreshes = 5000 } = options || {};

  useEffect(() => {
    let lastRefreshTime = Date.now();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefreshTime >= minTimeBetweenRefreshes) {
          queryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey });
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
