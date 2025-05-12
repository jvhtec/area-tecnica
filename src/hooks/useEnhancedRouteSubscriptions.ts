
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

// Define route-specific subscription requirements
export const ROUTE_SUBSCRIPTIONS: Record<string, string[]> = {
  "/": ["profiles"],
  "/dashboard": ["profiles", "jobs"],
  "/technician-dashboard": ["profiles", "jobs", "job_assignments"],
  "/availability": ["availability_schedules", "availability_preferences"],
  "/project-management": ["jobs", "tours", "tour_dates"],
  "/equipment": ["equipment", "global_stock_entries", "stock_movements"]
};

/**
 * Hook to manage subscriptions based on the current route
 */
export function useEnhancedRouteSubscriptions() {
  const queryClient = useQueryClient();
  const location = useLocation();
  
  // Create manager instance just once and memoize it
  const manager = useMemo(() => 
    UnifiedSubscriptionManager.getInstance(queryClient),
  [queryClient]);
  
  const [routeKey, setRouteKey] = useState(location.pathname);
  const [requiredTables, setRequiredTables] = useState<string[]>([]);
  const [subscribedTables, setSubscribedTables] = useState<string[]>([]);
  const [unsubscribedTables, setUnsubscribedTables] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>(
    manager.getConnectionStatus()
  );
  
  const [state, setState] = useState({
    isFullySubscribed: false,
    isStale: false,
    wasInactive: false,
    lastActiveTime: Date.now(),
    lastRefreshTime: Date.now(),
    unsubscribedTables: [] as string[],
  });
  
  // Memoize function to find matching route
  const findMatchingRoute = useCallback((path: string) => {
    const matchingRoutes = Object.keys(ROUTE_SUBSCRIPTIONS)
      .filter(route => path.startsWith(route))
      .sort((a, b) => b.length - a.length); // Sort by specificity (longest first)
      
    return matchingRoutes[0] || path;
  }, []);
  
  // Update route key and required tables when location changes
  useEffect(() => {
    console.log(`Configuring subscriptions for route: ${location.pathname}`);
    setRouteKey(location.pathname);
    
    // Find the most specific route that matches the current path
    const routeKeyForSubs = findMatchingRoute(location.pathname);
    console.log(`Using route key for subscriptions: ${routeKeyForSubs}`);
    
    // Clean up any subscriptions from the previous route
    if (routeKey !== location.pathname && typeof manager.cleanupRouteDependentSubscriptions === 'function') {
      console.log(`Cleaning up subscriptions for route: ${routeKey}`);
      manager.cleanupRouteDependentSubscriptions(routeKey);
    }
    
    // Determine required tables for this route
    const tablesForRoute = ROUTE_SUBSCRIPTIONS[routeKeyForSubs] || [];
    
    if (tablesForRoute.length > 0) {
      console.log(`Found subscription config for route ${routeKeyForSubs}: ${tablesForRoute.join(', ')}`);
    } else {
      console.log(`No subscription config found for route ${routeKeyForSubs}, using global tables only`);
    }
    
    // Global required tables for all routes
    const globalTables = ["profiles"];
    
    // Combine global tables with route-specific tables, removing duplicates
    const allRequiredTables = [...new Set([...globalTables, ...tablesForRoute])];
    setRequiredTables(allRequiredTables);
    
    // For each required table, subscribe with appropriate priority
    allRequiredTables.forEach(table => {
      console.log(`Subscribing to ${table} with priority medium`);
      if (typeof manager.subscribeToTable === 'function') {
        manager.subscribeToTable(table, [table], undefined, "medium");
        if (typeof manager.registerRouteSubscription === 'function') {
          manager.registerRouteSubscription(routeKeyForSubs, table);
        }
      }
    });
  }, [location.pathname, manager, routeKey, findMatchingRoute]);
  
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
  
  // Create a checkSubscriptionStatus function and memoize it
  const checkSubscriptionStatus = useCallback(() => {
    try {
      // Ensure consistent object structure with optional chaining
      const activeSubscriptions = typeof manager.getActiveSubscriptions === 'function' 
        ? manager.getActiveSubscriptions() 
        : [];
      
      // Get list of tables that are currently subscribed
      const currentlySubscribedTables = typeof manager.getSubscriptionsByTable === 'function'
        ? Object.keys(manager.getSubscriptionsByTable() || {})
        : [];
        
      setSubscribedTables(currentlySubscribedTables);
      
      // Find tables that should be subscribed but aren't
      const missingTables = requiredTables.filter(
        table => !currentlySubscribedTables.includes(table)
      );
      setUnsubscribedTables(missingTables);
      
      // Check how long since last activity
      const staleDuration = 5 * 60 * 1000; // 5 minutes
      const timeSinceLastActivity = Date.now() - state.lastActiveTime;
      const isStale = timeSinceLastActivity > staleDuration;
      
      setState(prev => ({
        ...prev,
        isFullySubscribed: missingTables.length === 0,
        isStale: isStale,
        unsubscribedTables: missingTables,
      }));
      
      if (typeof manager.getConnectionStatus === 'function') {
        setConnectionStatus(manager.getConnectionStatus());
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
    }
  }, [manager, requiredTables, state.lastActiveTime]);
  
  // Monitor subscription status
  useEffect(() => {
    // Check status immediately
    checkSubscriptionStatus();
    
    // Then check periodically
    const interval = setInterval(checkSubscriptionStatus, 10000); // Every 10 seconds
    
    return () => clearInterval(interval);
  }, [checkSubscriptionStatus]);
  
  // If there are missing subscriptions, try to resubscribe periodically
  useEffect(() => {
    if (unsubscribedTables.length > 0) {
      console.log("Still missing subscriptions, attempting to resubscribe");
      const timeout = setTimeout(() => {
        console.log("Manually forcing refresh of all subscriptions");
        if (typeof manager.reestablishSubscriptions === 'function') {
          manager.reestablishSubscriptions();
        }
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [unsubscribedTables, manager]);
  
  /**
   * Force a refresh of all subscriptions - memoize to prevent recreation
   */
  const forceRefresh = useCallback(() => {
    console.log('Manually forcing refresh of all subscriptions');
    
    // Reset the stale flag
    setState(prev => ({
      ...prev,
      isStale: false,
      lastActiveTime: Date.now(),
      lastRefreshTime: Date.now(),
    }));
    
    // Reestablish all subscriptions
    if (typeof manager.reestablishSubscriptions === 'function') {
      manager.reestablishSubscriptions();
    }
    
    // After a short delay, invalidate all queries to fetch fresh data
    setTimeout(() => {
      queryClient.invalidateQueries();
    }, 500);
  }, [manager, queryClient]);
  
  return {
    forceRefresh,
    isFullySubscribed: state.isFullySubscribed,
    isStale: state.isStale,
    wasInactive: state.wasInactive,
    lastActiveTime: state.lastActiveTime,
    unsubscribedTables: state.unsubscribedTables,
    lastRefreshTime: state.lastRefreshTime,
    requiredTables,
    subscribedTables,
    connectionStatus,
    routeKey
  };
}
