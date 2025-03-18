
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type RefreshCallback = () => void;

export const useRefreshOnTabVisibility = (
  queryKeysOrCallback: string[] | RefreshCallback, 
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
      if (typeof queryKeysOrCallback === 'function') {
        // If it's a callback function, call it directly
        queryKeysOrCallback();
      } else if (Array.isArray(queryKeysOrCallback)) {
        // If it's an array of query keys, invalidate them
        queryKeysOrCallback.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
      lastRefreshTime = Date.now();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefreshTime >= minTimeBetweenRefreshes) {
          if (typeof queryKeysOrCallback === 'function') {
            // If it's a callback function, call it directly
            queryKeysOrCallback();
          } else if (Array.isArray(queryKeysOrCallback)) {
            // If it's an array of query keys, invalidate them
            queryKeysOrCallback.forEach(key => {
              queryClient.invalidateQueries({ queryKey: [key] });
            });
          }
          lastRefreshTime = now;
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, queryKeysOrCallback, minTimeBetweenRefreshes, refreshOnMount]);
};
