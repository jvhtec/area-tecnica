
import { useEffect, useRef } from "react";
import { checkNetworkConnection, getRealtimeConnectionStatus, ensureRealtimeConnection } from "@/lib/enhanced-supabase-client";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { TokenManager } from "@/lib/token-manager";

// Exponential backoff helper
const calculateBackoff = (attempt: number, baseMs: number = 1000, maxMs: number = 30000): number => {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
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
    
    // Set up periodic connection health check with exponential backoff
    const checkConnectionHealth = async () => {
      // Don't check too frequently
      const now = Date.now();
      if (now - lastConnectionCheck.current < 30000) return;
      lastConnectionCheck.current = now;
      
      try {
        // Get current connection status
        const rtStatus = getRealtimeConnectionStatus();
        const hasNetworkConnection = await checkNetworkConnection();
        
        // If realtime is disconnected but we have network, try to reconnect
        if (rtStatus === 'DISCONNECTED' && hasNetworkConnection) {
          console.log('Detected realtime disconnect with active network, attempting recovery');
          
          // Increment attempts for backoff calculation
          connectionAttempts.current += 1;
          
          // Apply exponential backoff
          const backoff = calculateBackoff(connectionAttempts.current - 1);
          console.log(`Reconnection attempt ${connectionAttempts.current} with backoff: ${backoff}ms`);
          
          // Wait for backoff period
          await new Promise(resolve => setTimeout(resolve, backoff));
          
          // Attempt reconnection
          manager.reestablishSubscriptions();
          
          // Also check if token needs refresh
          tokenManager.getSession(true).catch(err => {
            console.error('Error refreshing session during recovery:', err);
          });
        } else if (rtStatus === 'CONNECTED') {
          // Reset attempts counter when connected
          connectionAttempts.current = 0;
        }
      } catch (error) {
        console.error('Error in connection health check:', error);
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
  
  // Use the enhanced route subscriptions hook to manage subscriptions
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
    }
  }, [subscriptionStatus.wasInactive, queryClient]);
  
  // Handle route changes with improved subscription management
  useEffect(() => {
    // When route changes, check if the new route has all required subscriptions
    if (!subscriptionStatus.isFullySubscribed) {
      console.log('Not fully subscribed to required tables for route:', location.pathname);
      console.log('Missing tables:', subscriptionStatus.unsubscribedTables);
      
      // Progressive retry with exponential backoff
      const retrySubscriptions = (attempt: number) => {
        if (attempt > 3) return; // Maximum 3 retry attempts
        
        const delay = calculateBackoff(attempt);
        setTimeout(() => {
          if (subscriptionStatus.unsubscribedTables.length > 0) {
            console.log(`Retry ${attempt + 1}: Re-establishing subscriptions for:`, subscriptionStatus.unsubscribedTables);
            subscriptionStatus.forceRefresh();
            retrySubscriptions(attempt + 1);
          }
        }, delay);
      };
      
      // Start retry process after initial delay
      retrySubscriptions(0);
    }
  }, [location.pathname, subscriptionStatus]);
  
  // Listen for network reconnection events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      ensureRealtimeConnection().then(success => {
        if (success) {
          queryClient.invalidateQueries();
          toast.success('Connection restored', {
            description: 'Network is back online, refreshing data'
          });
        }
      });
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [queryClient]);
  
  // This component doesn't render anything
  return null;
}
