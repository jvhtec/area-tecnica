
import { useEffect, useRef } from "react";
import { checkNetworkConnection, getRealtimeConnectionStatus, ensureRealtimeConnection } from "@/lib/enhanced-supabase-client";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { TokenManager } from "@/lib/token-manager";

// Debounce function to prevent excessive executions
const debounce = (fn: Function, ms = 300) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 * IMPORTANT: Must be used inside QueryClientProvider
 */
export function AppInit() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const isInitialized = useRef(false);
  const lastConnectionCheck = useRef(0);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttempts = useRef(0);
  
  // Initialize app services once
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    console.log('Initializing core services...');
    
    // Initialize token manager
    const tokenManager = TokenManager.getInstance();
    
    // Initialize the subscription manager
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    manager.setupVisibilityBasedRefetching();
    manager.setupNetworkStatusRefetching();
    
    // Subscribe to token refresh events
    tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      manager.reestablishSubscriptions();
    });
    
    // Listen for network status changes with debounce
    const debouncedConnectionCheck = debounce(async () => {
      const now = Date.now();
      if (now - lastConnectionCheck.current < 10000) return; // Don't check more than once every 10s
      lastConnectionCheck.current = now;
      
      console.log("Checking connection status...");
      const isOnline = navigator.onLine;
      const rtStatus = getRealtimeConnectionStatus();
      
      if (isOnline && rtStatus === 'DISCONNECTED') {
        await ensureRealtimeConnection();
      }
    }, 1000);
    
    window.addEventListener('online', debouncedConnectionCheck);
    window.addEventListener('offline', debouncedConnectionCheck);
    
    // Set up custom token refresh event listener
    const handleTokenRefreshNeeded = debounce(() => {
      console.log("Token refresh requested");
      tokenManager.refreshToken().catch(console.error);
    }, 500);
    
    window.addEventListener('token-refresh-needed', handleTokenRefreshNeeded);
    
    // Return cleanup
    return () => {
      window.removeEventListener('online', debouncedConnectionCheck);
      window.removeEventListener('offline', debouncedConnectionCheck);
      window.removeEventListener('token-refresh-needed', handleTokenRefreshNeeded);
      
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
    };
  }, [queryClient]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions
  const subscriptionStatus = useEnhancedRouteSubscriptions();
  
  // Handle subscription staleness
  useEffect(() => {
    if (subscriptionStatus.isStale) {
      console.log('Subscriptions are stale, refreshing...');
      
      // Only refresh if we haven't done so recently (debounce)
      const debounceTime = 30000; // 30 seconds
      const now = Date.now();
      
      if (now - lastConnectionCheck.current > debounceTime) {
        lastConnectionCheck.current = now;
        subscriptionStatus.forceRefresh();
        
        // Notify the user that subscriptions are being refreshed
        toast.info('Refreshing stale data...', {
          description: 'Your connection was inactive for a while, updating now',
        });
      }
    }
  }, [subscriptionStatus.isStale]);
  
  // Handle route changes
  useEffect(() => {
    // When route changes, check if we need to recover subscriptions
    if (!subscriptionStatus.isFullySubscribed) {
      console.log('Missing subscriptions for route:', location.pathname);
      console.log('Missing tables:', subscriptionStatus.unsubscribedTables);
      
      const attemptRecovery = debounce(() => {
        if (subscriptionStatus.unsubscribedTables.length > 0) {
          console.log("Attempting to recover missing subscriptions");
          subscriptionStatus.forceRefresh();
        }
      }, 500);
      
      attemptRecovery();
    }
  }, [location.pathname, subscriptionStatus]);
  
  // This component doesn't render anything
  return null;
}
