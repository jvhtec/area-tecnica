
import { useEffect, useRef } from "react";
import { checkNetworkConnection, getRealtimeConnectionStatus } from "@/lib/supabase-client";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { TokenManager } from "@/lib/token-manager";

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
    
    // Set up periodic connection health check
    const checkConnectionHealth = async () => {
      // Don't check too frequently
      const now = Date.now();
      if (now - lastConnectionCheck.current < 30000) return;
      lastConnectionCheck.current = now;
      
      // Get current connection status
      const rtStatus = getRealtimeConnectionStatus();
      const hasNetworkConnection = await checkNetworkConnection();
      
      // If realtime is disconnected but we have network, try to reconnect
      if (rtStatus === 'DISCONNECTED' && hasNetworkConnection) {
        console.log('Detected realtime disconnect with active network, attempting recovery');
        manager.reestablishSubscriptions();
        
        // Check if token needs refresh
        tokenManager.getSession(true).catch(err => {
          console.error('Error refreshing session during recovery:', err);
        });
      }
    };
    
    // Set up health check interval
    connectionCheckIntervalRef.current = setInterval(() => {
      checkConnectionHealth().catch(err => {
        console.error('Error in connection health check:', err);
      });
    }, 60000); // Check every minute
    
    // Return cleanup
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
    };
  }, [queryClient]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions based on the current route
  const subscriptionStatus = useEnhancedRouteSubscriptions();
  
  // Handle subscription staleness
  useEffect(() => {
    if (subscriptionStatus.isStale) {
      console.log('Subscriptions are stale, refreshing...');
      subscriptionStatus.forceRefresh();
      
      // Notify the user that subscriptions are being refreshed
      toast.info('Refreshing stale data...', {
        description: 'Your connection was inactive for a while, updating now',
      });
    }
  }, [subscriptionStatus.isStale]);
  
  // Handle subscription refresh when coming back after inactivity
  useEffect(() => {
    if (subscriptionStatus.wasInactive) {
      console.log('Page was inactive, refreshing subscriptions');
      
      // Force a refresh of all queries
      queryClient.invalidateQueries();
      
      // Notify the user that data is being refreshed
      toast.info('Updating after inactivity', {
        description: 'Refreshing data after returning to the page',
      });
    }
  }, [subscriptionStatus.wasInactive, queryClient]);
  
  // Handle route changes
  useEffect(() => {
    // When route changes, check if the new route has all required subscriptions
    if (!subscriptionStatus.isFullySubscribed) {
      console.log('Not fully subscribed to required tables, checking what is missing');
      console.log('Missing tables:', subscriptionStatus.unsubscribedTables);
      
      // If there are missing subscriptions after a short delay, try to reestablish them
      const delayTimeout = setTimeout(() => {
        if (subscriptionStatus.unsubscribedTables.length > 0) {
          console.log('Still missing subscriptions, attempting to resubscribe');
          subscriptionStatus.forceRefresh();
        }
      }, 1000);
      
      return () => clearTimeout(delayTimeout);
    }
  }, [location.pathname, subscriptionStatus]);
  
  // This component doesn't render anything
  return null;
}
