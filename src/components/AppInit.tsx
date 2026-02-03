import React, { useEffect, useMemo, useRef, useState } from "react";
import { checkNetworkConnection, getRealtimeConnectionStatus, ensureRealtimeConnection } from "@/lib/enhanced-supabase-client";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useRouteSubscriptions } from "@/hooks/useRouteSubscriptions";
import { toast } from "sonner";
import { TokenManager } from "@/lib/token-manager";
import { MultiTabCoordinator } from "@/lib/multitab-coordinator";
import { updateQueryClientForRole } from "@/lib/optimized-react-query";

// Exponential backoff helper
const calculateBackoff = (attempt: number, baseMs: number = 1000, maxMs: number = 30000): number => {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs);
};

/**
 * Initializes app-level subscription, connection, and multi-tab coordination tied to router context.
 *
 * Handles tab leadership changes and updates the query client role; when the tab is leader it:
 * - Performs periodic connection health checks with exponential backoff while the page is visible.
 * - Sets up visibility- and network-based global invalidation/refetching.
 * - Refreshes stale subscriptions and retries missing route subscriptions with exponential backoff.
 * - Responds to network reconnection by ensuring realtime connection and coordinating invalidation across tabs.
 *
 * Also requests subscription work from the leader when running as a follower, and attaches appropriate
 * visibility/online event listeners. This component does not render any UI.
 *
 * @returns `null` (this component does not render any UI)
 */
function AppInitWithRouter() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const multiTabCoordinator = useMemo(() => MultiTabCoordinator.getInstance(queryClient), [queryClient]);
  const manager = useMemo(() => UnifiedSubscriptionManager.getInstance(queryClient), [queryClient]);
  const lastConnectionCheck = useRef(0);
  const connectionAttempts = useRef(0);
  const [isLeader, setIsLeader] = useState(() => multiTabCoordinator.getIsLeader());
  
  // Listen for tab role changes
  useEffect(() => {
    const handleTabRoleChange = (event: CustomEvent) => {
      const newIsLeader = event.detail.isLeader;
      setIsLeader(newIsLeader);
      
      // Update query client options based on role
      updateQueryClientForRole(queryClient, newIsLeader);
      
      console.log(`Tab role changed: ${newIsLeader ? 'leader' : 'follower'}`);
    };
    
    window.addEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    
    return () => {
      window.removeEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    };
  }, [queryClient]);

  // Enable subscription health checks only for the leader and only while visible.
  useEffect(() => {
    if (!isLeader) {
      return;
    }

    console.log('Initializing leader health checks...');

    const tokenManager = TokenManager.getInstance();
    let intervalId: number | null = null;

    // Set up periodic connection health check with exponential backoff (only for leader)
    const checkConnectionHealth = async () => {
      // Only run health checks if we're the leader
      if (!isLeader) return;
      
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
    
    const start = () => {
      if (intervalId) return;
      intervalId = window.setInterval(() => {
        checkConnectionHealth().catch(err => {
          console.error('Error in connection health check:', err);
        });
      }, 60000);
    };

    const stop = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      checkConnectionHealth().catch(err => {
        console.error('Error in connection health check:', err);
      });
      start();
    };

    document.addEventListener('visibilitychange', handleVisibility, { passive: true });
    handleVisibility();
    
    // Return cleanup
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLeader, manager]);

  // Only the leader should attach global invalidation/refetch triggers.
  useEffect(() => {
    if (isLeader) {
      manager.setupVisibilityBasedRefetching();
      manager.setupNetworkStatusRefetching();
      return;
    }

    manager.teardownVisibilityBasedRefetching();
    manager.teardownNetworkStatusRefetching();
  }, [isLeader, manager]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions
  const subscriptionStatus = useRouteSubscriptions();
  
  // Handle subscription staleness (only for leader)
  useEffect(() => {
    if (subscriptionStatus.isStale && isLeader) {
      console.log('Subscriptions are stale, refreshing...');
      subscriptionStatus.forceRefresh();
      
      // Notify the user that subscriptions are being refreshed (only leader shows toasts)
      toast.info('Refreshing stale data...', {
        description: 'Your connection was inactive for a while, updating now',
      });
    }
  }, [subscriptionStatus.isStale, isLeader]);
  
  // Handle route changes with improved subscription management (only for leader)
  useEffect(() => {
    // When route changes, check if the new route has all required subscriptions
    if (!subscriptionStatus.isFullySubscribed && isLeader) {
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
    } else if (!isLeader) {
      // If we're a follower, request the leader to handle missing subscriptions
      if (subscriptionStatus.unsubscribedTables.length > 0) {
        multiTabCoordinator.requestSubscriptions(subscriptionStatus.unsubscribedTables);
      }
    }
  }, [location.pathname, subscriptionStatus, isLeader, multiTabCoordinator]);
  
  // Listen for network reconnection events (only for leader)
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      
      if (isLeader) {
        ensureRealtimeConnection().then(success => {
          if (success) {
            // Use coordinator to sync invalidation across tabs
            multiTabCoordinator.invalidateQueries();
            toast.success('Connection restored', {
              description: 'Network is back online, refreshing data'
            });
          }
        });
      }
    };
    
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isLeader, multiTabCoordinator]);
  
  // This component doesn't render anything
  return null;
}

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI
 * IMPORTANT: Must be used inside QueryClientProvider
 * Safely handles router context availability
 */
export function AppInit() {
  return <AppInitWithRouter />;
}