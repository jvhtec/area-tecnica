
// Re-export the main Supabase client and utilities
import { supabase, checkNetworkConnection, getRealtimeConnectionStatus } from './supabase-client';

export { 
  supabase, 
  checkNetworkConnection, 
  getRealtimeConnectionStatus 
};

// Enhanced client utilities
/**
 * Checks if the Supabase realtime connection is healthy
 * and attempts recovery if needed
 */
export async function ensureRealtimeConnection(): Promise<boolean> {
  const status = getRealtimeConnectionStatus();
  
  if (status === 'DISCONNECTED') {
    console.log('Realtime connection is disconnected, attempting recovery');
    const isNetworkAvailable = await checkNetworkConnection();
    
    if (isNetworkAvailable) {
      // Dispatch reconnect event to trigger subscription recovery
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      return true;
    } else {
      console.log('Network connection unavailable, cannot recover realtime connection');
      return false;
    }
  }
  
  return status === 'CONNECTED';
}

/**
 * Monitors connection health and triggers refresh as needed
 * @param onConnectionChange Optional callback when connection status changes
 * @returns Cleanup function
 */
export function monitorConnectionHealth(
  onConnectionChange?: (isConnected: boolean) => void
): () => void {
  let lastStatus = getRealtimeConnectionStatus() === 'CONNECTED';
  onConnectionChange?.(lastStatus);
  
  const checkInterval = setInterval(async () => {
    const currentStatus = getRealtimeConnectionStatus() === 'CONNECTED';
    
    // If status changed, notify callback
    if (currentStatus !== lastStatus) {
      lastStatus = currentStatus;
      onConnectionChange?.(currentStatus);
      
      // If we're now connected, trigger a data refresh
      if (currentStatus) {
        window.dispatchEvent(new CustomEvent('connection-restored'));
      }
    }
    
    // If disconnected, try recovery
    if (!currentStatus) {
      await ensureRealtimeConnection();
    }
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(checkInterval);
}
