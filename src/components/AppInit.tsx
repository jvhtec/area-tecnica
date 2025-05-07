
import { useEffect } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 * IMPORTANT: Must be used inside QueryClientProvider
 */
export function AppInit() {
  const queryClient = useQueryClient();
  const location = useLocation();
  
  // Initialize the connection recovery service
  useEffect(() => {
    connectionRecovery.startRecovery();
    console.log('Connection recovery service initialized');
  }, []);
  
  // Initialize the unified subscription manager
  useEffect(() => {
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    manager.setupVisibilityBasedRefetching();
    manager.setupNetworkStatusRefetching();
    console.log('Unified subscription manager initialized');
    
    // Set up a periodic health check for subscriptions
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
