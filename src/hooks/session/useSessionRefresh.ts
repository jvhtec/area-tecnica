
import { useCallback, useEffect, useState } from "react";
import { TokenManager } from "@/lib/token-manager";

export const useSessionRefresh = () => {
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tokenManager = TokenManager.getInstance();

  const refreshSession = useCallback(async () => {
    console.log("Attempting session refresh...");
    if (isRefreshing) {
      console.log("Refresh already in progress, skipping");
      return null;
    }

    try {
      setIsRefreshing(true);
      const success = await tokenManager.refreshToken();
      
      if (success) {
        console.log("Session refreshed successfully");
        setLastRefresh(Date.now());
        return await tokenManager.getSession();
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

  // Subscribe to token refresh events
  useEffect(() => {
    const unsubscribe = tokenManager.subscribe(() => {
      setLastRefresh(Date.now());
    });
    
    return unsubscribe;
  }, []);

  // Update last refresh time when component mounts
  useEffect(() => {
    setLastRefresh(tokenManager.getTimeSinceLastRefresh());
  }, []);

  return { 
    refreshSession, 
    lastRefresh, 
    isRefreshing,
    tokenManager
  };
};
