
import { useEffect } from 'react';

/**
 * Hook to refresh data when tab becomes visible.
 * @param callback Function to call when the tab becomes visible
 * @param dependencies Dependencies array for the effect
 */
export const useRefreshOnTabVisibility = (
  callback: () => void,
  dependencies: any[] = []
) => {
  useEffect(() => {
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab is now visible, refreshing data');
        callback();
      }
    };

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up the event listener on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [...dependencies, callback]);
};
