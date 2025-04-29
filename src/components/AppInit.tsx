
import { useEffect } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";

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
  }, [queryClient]);
  
  // Use the enhanced route subscriptions hook to manage subscriptions based on the current route
  const subscriptionStatus = useEnhancedRouteSubscriptions();
  
  // Handle subscription staleness
  useEffect(() => {
    if (subscriptionStatus.isStale) {
      console.log('Subscriptions are stale, refreshing...');
      subscriptionStatus.forceRefresh();
    }
  }, [subscriptionStatus.isStale]);
  
  // Handle subscription refresh when coming back after inactivity
  useEffect(() => {
    if (subscriptionStatus.wasInactive) {
      console.log('Page was inactive, refreshing subscriptions');
    }
  }, [subscriptionStatus.wasInactive]);
  
  // This component doesn't render anything
  return null;
}
