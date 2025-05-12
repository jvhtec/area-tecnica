
import { useEffect, useRef, memo } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { SessionManager } from "@/lib/session-manager";
import { useSessionManager } from "@/hooks/useSessionManager";
import { debounce } from "@/lib/utils";

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 * IMPORTANT: Must be used inside QueryClientProvider
 * Using memo to prevent unnecessary re-renders
 */
export const AppInit = memo(function AppInit() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { isInitialized, status, isAuthenticated } = useSessionManager();
  const initCompletedRef = useRef(false);
  const toastDisplayedRef = useRef({
    stale: false,
    inactive: false,
    sessionError: false
  });
  
  // Skip initialization on auth page to prevent loops
  const shouldInitialize = location.pathname !== '/auth' && isAuthenticated;
  
  // Initialize the connection recovery service
  useEffect(() => {
    // Skip initialization on auth page to prevent loops
    if (!shouldInitialize) {
      return;
    }
    
    connectionRecovery.startRecovery();
    console.log('Connection recovery service initialized');
  }, [shouldInitialize]);
  
  // Initialize the unified subscription manager
  useEffect(() => {
    // Skip initialization if conditions aren't met
    if (!shouldInitialize) {
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
  }, [queryClient, shouldInitialize]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions based on the current route
  // Only if conditions are met to prevent constant reinitializations
  const subscriptionStatus = shouldInitialize 
    ? useEnhancedRouteSubscriptions() 
    : { isStale: false, wasInactive: false, forceRefresh: () => {}, isFullySubscribed: true, unsubscribedTables: [] };
  
  // Initialize the session manager
  useEffect(() => {
    // Skip excessive event handlers on auth page
    if (!shouldInitialize) {
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
    
    // Create a debounced error toast to prevent spamming
    const debouncedErrorToast = debounce(() => {
      if (!toastDisplayedRef.current.sessionError) {
        toastDisplayedRef.current.sessionError = true;
        toast.error("Authentication error", {
          description: "There was a problem with your session. Attempting to recover.",
          id: "session-refresh-error", // Use ID to prevent duplicate toasts
          onDismiss: () => {
            // Reset after 30 seconds
            setTimeout(() => {
              toastDisplayedRef.current.sessionError = false;
            }, 30000);
          }
        });
      }
    }, 2000);
    
    const sessionErrorUnsubscribe = sessionManager.on("refresh-error", (error) => {
      console.error("Session refresh error:", error);
      // Use a debounced toast to prevent excessive notifications
      debouncedErrorToast();
    });
    
    const recoveryAttemptUnsubscribe = sessionManager.on("recovery-attempt", (attempt) => {
      console.log(`Recovery attempt ${attempt}`);
      // Only show toast for first attempt to prevent spamming
      if (attempt === 1) {
        toast.info("Attempting to restore your session", {
          description: `Recovery attempt ${attempt}`,
          id: "session-recovery", // Use ID to prevent duplicate toasts
        });
      }
    });
    
    return () => {
      sessionRefreshedUnsubscribe();
      sessionErrorUnsubscribe();
      recoveryAttemptUnsubscribe();
    };
  }, [subscriptionStatus, shouldInitialize]);
  
  // Handle subscription staleness
  useEffect(() => {
    // Skip on auth page and when not authenticated
    if (!shouldInitialize) {
      return;
    }
    
    if (subscriptionStatus.isStale && !toastDisplayedRef.current.stale) {
      console.log('Subscriptions are stale, refreshing...');
      // Use a debounced refresh approach to prevent rapid updates
      const refreshTimer = setTimeout(() => {
        subscriptionStatus.forceRefresh();
        
        // Notify the user that subscriptions are being refreshed (rate-limited)
        toastDisplayedRef.current.stale = true;
        toast.info('Refreshing stale data...', {
          description: 'Your connection was inactive for a while, updating now',
          id: "stale-refresh-notification", // Use ID to prevent duplicate toasts
          onDismiss: () => {
            // Reset after a minute
            setTimeout(() => {
              toastDisplayedRef.current.stale = false;
            }, 60000);
          }
        });
      }, 1000);
      
      return () => clearTimeout(refreshTimer);
    }
  }, [subscriptionStatus.isStale, shouldInitialize]);
  
  // Handle subscription refresh when coming back after inactivity
  useEffect(() => {
    // Skip on auth page
    if (!shouldInitialize) {
      return;
    }
    
    if (subscriptionStatus.wasInactive && !toastDisplayedRef.current.inactive) {
      console.log('Page was inactive, refreshing subscriptions');
      
      // Debounce to prevent rapid updates
      const inactivityTimer = setTimeout(() => {
        // Also validate the session when coming back from inactivity
        const sessionManager = SessionManager.getInstance();
        sessionManager.validateAndRefreshSession();
        
        // Force a refresh of all queries
        queryClient.invalidateQueries();
        
        // Notify the user that data is being refreshed (rate-limited)
        toastDisplayedRef.current.inactive = true;
        toast.info('Updating after inactivity', {
          description: 'Refreshing data after returning to the page',
          id: "inactivity-refresh", // Use ID to prevent duplicate toasts
          onDismiss: () => {
            // Reset after a minute
            setTimeout(() => {
              toastDisplayedRef.current.inactive = false;
            }, 60000);
          }
        });
      }, 1000);
      
      return () => clearTimeout(inactivityTimer);
    }
  }, [subscriptionStatus.wasInactive, queryClient, shouldInitialize]);
  
  // This component doesn't render anything
  return null;
});
