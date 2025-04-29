
import { useEffect } from "react";
import { connectionRecovery } from "@/lib/connection-recovery-service";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useLocation } from "react-router-dom";

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
  
  // Set up route-based subscription cleaning
  useEffect(() => {
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    
    // Clean up unused subscriptions when route changes
    manager.cleanupRouteDependentSubscriptions(location.pathname);
    
  }, [location.pathname, queryClient]);
  
  // This component doesn't render anything
  return null;
}
