
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useRefreshOnTabVisibility = (
  queryKeys: string[], 
  options?: { 
    minTimeBetweenRefreshes?: number;
    refreshOnMount?: boolean;
  }
) => {
  const queryClient = useQueryClient();
  const { minTimeBetweenRefreshes = 5000, refreshOnMount = true } = options || {};

  useEffect(() => {
    let lastRefreshTime = Date.now();
    
    if (refreshOnMount) {
      // Initial refresh
      queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      lastRefreshTime = Date.now();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefreshTime >= minTimeBetweenRefreshes) {
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
  }, [queryClient, queryKeys, minTimeBetweenRefreshes, refreshOnMount]);
};
