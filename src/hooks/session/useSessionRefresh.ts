import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useSessionRefresh = () => {
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();
  const visibilityTimeoutRef = useRef<NodeJS.Timeout>();

  const refreshSession = useCallback(async () => {
    console.log("Attempting session refresh...");
    if (isRefreshing) {
      console.log("Refresh already in progress, skipping");
      return null;
    }

    try {
      setIsRefreshing(true);
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Error refreshing session:", error);
        throw error;
      }

      if (currentSession) {
        console.log("Session refreshed successfully");
        setLastRefresh(Date.now());
        return currentSession;
      }

      console.log("No session found during refresh");
      return null;
    } catch (error) {
      console.error("Error in refreshSession:", error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab became visible, scheduling session refresh");
        // Clear any existing timeout
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }
        // Add a small delay to ensure browser is ready
        visibilityTimeoutRef.current = setTimeout(() => {
          refreshSession();
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [refreshSession]);

  // Periodic session refresh
  useEffect(() => {
    const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes

    const scheduleNextRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          console.log("Initiating periodic session refresh");
          refreshSession();
        }
        scheduleNextRefresh();
      }, REFRESH_INTERVAL);
    };

    scheduleNextRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [refreshSession]);

  return { refreshSession, lastRefresh, isRefreshing };
};