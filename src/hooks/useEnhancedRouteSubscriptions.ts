
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

/**
 * Hook to manage subscriptions based on the current route
 */
export function useEnhancedRouteSubscriptions() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  
  const [state, setState] = useState({
    isFullySubscribed: false,
    isStale: false,
    wasInactive: false,
    lastActiveTime: Date.now(),
    unsubscribedTables: [] as string[],
  });
  
  // Track page visibility
  useEffect(() => {
    let wasHidden = false;
    let hiddenTime = 0;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (wasHidden) {
          const inactiveTime = Date.now() - hiddenTime;
          // If page was hidden for more than 30 seconds, consider it was inactive
          if (inactiveTime > 30000) {
            setState(prev => ({
              ...prev,
              wasInactive: true,
              lastActiveTime: Date.now(),
            }));
          }
          wasHidden = false;
        }
      } else if (document.visibilityState === "hidden") {
        wasHidden = true;
        hiddenTime = Date.now();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
  
  // Reset wasInactive flag after it's been handled
  useEffect(() => {
    if (state.wasInactive) {
      const timeout = setTimeout(() => {
        setState(prev => ({
          ...prev,
          wasInactive: false,
        }));
      }, 5000); // Reset after 5 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [state.wasInactive]);
  
  // Monitor subscription status
  useEffect(() => {
    const checkSubscriptionStatus = () => {
      const routeSubscriptions = manager.getActiveSubscriptions();
      const activeSubsCount = routeSubscriptions.length;
      
      // Determine which tables are missing subscriptions
      const requiredTables = ['profiles']; // Add more as needed for specific routes
      const subscribedTables = routeSubscriptions.map(sub => sub.table);
      const unsubscribedTables = requiredTables.filter(
        table => !subscribedTables.includes(table)
      );
      
      // Check how long since last activity
      const staleDuration = 5 * 60 * 1000; // 5 minutes
      const timeSinceLastActivity = Date.now() - state.lastActiveTime;
      const isStale = timeSinceLastActivity > staleDuration;
      
      setState(prev => ({
        ...prev,
        isFullySubscribed: unsubscribedTables.length === 0,
        isStale: isStale,
        unsubscribedTables,
      }));
      
      // If we're stale or missing subscriptions, let's output some debugging info
      if (isStale || unsubscribedTables.length > 0) {
        console.log(`Subscription status: ${activeSubsCount} active, ${unsubscribedTables.length} missing`);
        console.log('Time since last activity:', Math.round(timeSinceLastActivity / 1000), 'seconds');
      }
    };
    
    // Check status immediately
    checkSubscriptionStatus();
    
    // Then check periodically
    const interval = setInterval(checkSubscriptionStatus, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [location.pathname, manager, state.lastActiveTime]);
  
  /**
   * Force a refresh of all subscriptions
   */
  const forceRefresh = () => {
    console.log('Manually forcing refresh of all subscriptions');
    
    // Reset the stale flag
    setState(prev => ({
      ...prev,
      isStale: false,
      lastActiveTime: Date.now(),
    }));
    
    // Reestablish all subscriptions
    manager.reestablishSubscriptions();
    
    // After a short delay, invalidate all queries to fetch fresh data
    setTimeout(() => {
      queryClient.invalidateQueries();
    }, 500);
  };
  
  return {
    ...state,
    forceRefresh,
  };
}
