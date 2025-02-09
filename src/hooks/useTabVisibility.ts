import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const useTabVisibility = (queryKeys: string[]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing queries:', queryKeys);
        queryKeys.forEach(key => {
          // Force a refetch when tab becomes visible
          queryClient.invalidateQueries({ 
            queryKey: [key],
            refetchType: 'active',
            exact: false 
          });
        });
      }
    };

    // Initial check when component mounts
    if (document.visibilityState === 'visible') {
      handleVisibilityChange();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, queryKeys]);
};