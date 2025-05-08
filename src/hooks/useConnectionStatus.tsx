
import { useState, useEffect } from 'react';
import { connectionManager, ConnectionStatus } from '@/lib/connection-manager';
import { formatDistanceToNow } from 'date-fns';

/**
 * Hook to monitor connection status and provide refresh functionality
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(
    connectionManager.getConnectionStatus()
  );
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Register listener for connection status changes
  useEffect(() => {
    const unsubscribe = connectionManager.registerListener(newStatus => {
      setStatus(newStatus);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Function to manually refresh connections
  const refreshConnections = async () => {
    setIsRefreshing(true);
    try {
      // Force a refresh of all connections
      connectionManager.forceRefresh();
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("Error refreshing connections:", error);
    } finally {
      // Give visual feedback of refresh for at least 500ms
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500);
    }
  };
  
  // Format the time since last activity
  let formattedLastRefresh = "Unknown";
  try {
    formattedLastRefresh = formatDistanceToNow(lastRefreshTime, { addSuffix: true });
  } catch (error) {
    console.error("Error formatting refresh time:", error);
  }
  
  return {
    connectionState: status.state,
    isStale: status.isStale,
    lastActiveTime: status.lastActiveTimestamp,
    formattedLastRefresh,
    isRefreshing,
    refreshConnections
  };
}
