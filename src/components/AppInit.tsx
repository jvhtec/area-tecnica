
import { useEffect, useRef } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { SessionManager } from "@/lib/session-manager";
import { useSessionManager } from "@/hooks/useSessionManager";

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 * IMPORTANT: Must be used inside QueryClientProvider
 */
export function AppInit() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { isInitialized, status, isAuthenticated } = useSessionManager();
  const initCompletedRef = useRef(false);
  
  // Initialize the connection recovery service
  useEffect(() => {
    // Skip initialization on auth page to prevent loops
    if (location.pathname === '/auth') {
      return;
    }
    
    connectionRecovery.startRecovery();
    console.log('Connection recovery service initialized');
  }, [location.pathname]);
  
  // Initialize the unified subscription manager
  useEffect(() => {
    // Skip initialization on auth page to prevent loops
    if (location.pathname === '/auth') {
      return;
    }
    
    // Skip initialization if not authenticated
    if (!isAuthenticated) {
      return;
    }
    
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    
    // Track initialization status to prevent multiple setups
    if (!initCompletedRef.current) {
      manager.setupVisibilityBasedRefetching();
      manager.setupNetworkStatusRefetching();
      console.log('Unified subscription manager initialized');
      initCompletedRef.current = true;
    }
    
    // Rate-limited health check for subscriptions (max once per minute)
    const healthCheckInterval = setInterval(() => {
      const connectionStatus = manager.getConnectionStatus();
      if (connectionStatus !== 'connected') {
        console.log(`Connection status is ${connectionStatus}, attempting to reconnect`);
        manager.reestablishSubscriptions();
      }
    }, 60000); // Check every minute
    
    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [queryClient, isAuthenticated, location.pathname]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions based on the current route
  // Only if not on auth page to prevent constant reinitializations
  const subscriptionStatus = location.pathname !== '/auth' && isAuthenticated 
    ? useEnhancedRouteSubscriptions() 
    : { isStale: false, wasInactive: false, forceRefresh: () => {}, isFullySubscribed: true, unsubscribedTables: [] };
  
  // Initialize the session manager
  useEffect(() => {
    // Skip excessive event handlers on auth page
    if (location.pathname === '/auth') {
      return;
    }
    
    const sessionManager = SessionManager.getInstance();
    
    // Set up event listeners for session changes
    const sessionRefreshedUnsubscribe = sessionManager.on("session-refreshed", () => {
      // When session is refreshed, also refresh subscriptions to ensure fresh data
      if (subscriptionStatus.isStale || !subscriptionStatus.isFullySubscribed) {
        console.log('Session refreshed, refreshing stale subscriptions');
        subscriptionStatus.forceRefresh();
      }
    });
    
    const sessionErrorUnsubscribe = sessionManager.on("refresh-error", (error) => {
      console.error("Session refresh error:", error);
      // Use a debounced toast to prevent excessive notifications
      toast.error("Authentication error", {
        description: "There was a problem with your session. Attempting to recover.",
        id: "session-refresh-error", // Use ID to prevent duplicate toasts
      });
    });
    
    const recoveryAttemptUnsubscribe = sessionManager.on("recovery-attempt", (attempt) => {
      console.log(`Recovery attempt ${attempt}`);
      // Use a debounced toast to prevent excessive notifications
      toast.info("Attempting to restore your session", {
        description: `Recovery attempt ${attempt}`,
        id: "session-recovery", // Use ID to prevent duplicate toasts
      });
    });
    
    return () => {
      sessionRefreshedUnsubscribe();
      sessionErrorUnsubscribe();
      recoveryAttemptUnsubscribe();
    };
  }, [subscriptionStatus, location.pathname]);
  
  // Handle subscription staleness
  useEffect(() => {
    // Skip on auth page and when not authenticated
    if (location.pathname === '/auth' || !isAuthenticated) {
      return;
    }
    
    if (subscriptionStatus.isStale) {
      console.log('Subscriptions are stale, refreshing...');
      // Use a debounced refresh approach to prevent rapid updates
      const refreshTimer = setTimeout(() => {
        subscriptionStatus.forceRefresh();
        
        // Notify the user that subscriptions are being refreshed (rate-limited)
        toast.info('Refreshing stale data...', {
          description: 'Your connection was inactive for a while, updating now',
          id: "stale-refresh-notification", // Use ID to prevent duplicate toasts
        });
      }, 1000);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [subscriptionStatus.isStale, isAuthenticated, location.pathname]);
  
  // Handle subscription refresh when coming back after inactivity
  useEffect(() => {
    // Skip on auth page
    if (location.pathname === '/auth' || !isAuthenticated) {
      return;
    }
    
    if (subscriptionStatus.wasInactive) {
      console.log('Page was inactive, refreshing subscriptions');
      
      // Debounce to prevent rapid updates
      const inactivityTimer = setTimeout(() => {
        // Also validate the session when coming back from inactivity
        const sessionManager = SessionManager.getInstance();
        sessionManager.validateAndRefreshSession();
        
        // Force a refresh of all queries
        queryClient.invalidateQueries();
        
        // Notify the user that data is being refreshed
        toast.info('Updating after inactivity', {
          description: 'Refreshing data after returning to the page',
          id: "inactivity-refresh", // Use ID to prevent duplicate toasts
        });
      }, 1000);
      
      return () => clearTimeout(inactivityTimer);
    }
  }, [subscriptionStatus.wasInactive, queryClient, isAuthenticated, location.pathname]);
  
  // This component doesn't render anything
  return null;
}
