
import { useEffect, useState, useRef } from "react";
import { connectionManager } from "@/lib/connection-manager";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useEnhancedRouteSubscriptions } from "@/hooks/useEnhancedRouteSubscriptions";
import { toast } from "sonner";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/**
 * Component that initializes app-wide services when the application starts
 * Doesn't render anything to the UI normally, but will show an alert when connection issues are detected
 * IMPORTANT: Must be used inside QueryClientProvider
 */
export function AppInit() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [showReconnectAlert, setShowReconnectAlert] = useState(false);
  const inactivityTimer = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const alertDismissedRef = useRef<boolean>(false);
  
  // Initialize the connection manager
  useEffect(() => {
    connectionManager.initialize(queryClient);
    console.log('Connection manager initialized');
    
    return () => {
      connectionManager.cleanup();
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
      
      // Force a validation of connections
      connectionManager.validateConnections(true);
      
      // Notify the user that data is being refreshed
      toast.info('Updating after inactivity', {
        description: 'Refreshing data after returning to the page',
      });
    }
  }, [subscriptionStatus.wasInactive]);
  
  // Handle route changes
  useEffect(() => {
    // Reset alert dismissal on route change
    alertDismissedRef.current = false;
    
    // When route changes, check if the new route has all required subscriptions
    if (!subscriptionStatus.isFullySubscribed) {
      console.log('Not fully subscribed to required tables, checking what is missing');
      console.log('Missing tables:', subscriptionStatus.unsubscribedTables);
      
      // If there are missing subscriptions after a short delay, try to reestablish them
      const delayTimeout = setTimeout(() => {
        if (subscriptionStatus.unsubscribedTables.length > 0) {
          console.log('Still missing subscriptions, attempting to resubscribe');
          connectionManager.validateConnections(true);
          
          // If still having issues, show reconnect alert
          setTimeout(() => {
            if (subscriptionStatus.unsubscribedTables.length > 0 && !alertDismissedRef.current) {
              setShowReconnectAlert(true);
            }
          }, 5000);
        }
      }, 1000);
      
      return () => clearTimeout(delayTimeout);
    } else {
      // Hide alert when everything is working
      setShowReconnectAlert(false);
    }
  }, [location.pathname, subscriptionStatus]);
  
  // Track user activity
  useEffect(() => {
    const handleUserActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Reset inactivity timer
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
      }
      
      // Set new inactivity timer
      inactivityTimer.current = window.setTimeout(() => {
        const inactiveDuration = Date.now() - lastActivityRef.current;
        if (inactiveDuration > 5 * 60 * 1000) { // 5 minutes
          console.log(`User inactive for ${Math.round(inactiveDuration / 1000)}s, validating connections`);
          connectionManager.validateConnections();
        }
      }, 5 * 60 * 1000); // Check after 5 minutes of inactivity
    };
    
    // Set initial activity timestamp
    lastActivityRef.current = Date.now();
    
    // Add event listeners for user activity
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
      document.addEventListener(eventType, handleUserActivity, { passive: true });
    });
    
    return () => {
      // Remove event listeners
      ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(eventType => {
        document.removeEventListener(eventType, handleUserActivity);
      });
      
      // Clear inactivity timer
      if (inactivityTimer.current) {
        window.clearTimeout(inactivityTimer.current);
      }
    };
  }, []);
  
  // Handle manual reconnection
  const handleManualReconnect = () => {
    setShowReconnectAlert(false);
    alertDismissedRef.current = true;
    connectionManager.forceRefresh();
    
    toast.info('Reconnecting...', {
      description: 'Attempting to restore all connections',
    });
  };
  
  // This component normally doesn't render anything, but will show an alert when connection issues are detected
  if (showReconnectAlert) {
    return (
      <div className="fixed bottom-4 left-0 right-0 mx-auto w-full max-w-md z-50">
        <Alert variant="info" className="shadow-lg border-blue-300">
          <AlertTitle>Connection issues detected</AlertTitle>
          <AlertDescription>
            <p className="mb-2">Some real-time updates may not be working correctly.</p>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleManualReconnect}
              className="flex items-center gap-2"
            >
              <RefreshCw size={14} />
              Reconnect Now
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  return null;
}
