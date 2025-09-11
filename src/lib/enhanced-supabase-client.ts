
// Re-export the main Supabase client and utilities
import { supabase, checkNetworkConnection, getRealtimeConnectionStatus } from './supabase-client';
import { retryWithBackoff, isOnline } from './network-utils';
import { toast } from '@/hooks/use-toast';

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
  try {
    // Check network connectivity first with retry
    const isConnected = await retryWithBackoff(
      () => checkNetworkConnection(),
      { maxRetries: 2, baseDelay: 500 }
    );
    
    if (!isConnected) {
      console.log('No network connection detected after retries');
      return false;
    }

    const status = getRealtimeConnectionStatus();
    console.log('Current realtime connection status:', status);
    
    if (status === 'DISCONNECTED') {
      console.log('Realtime connection is disconnected, attempting recovery');
      
      console.log('Network connection available, triggering reconnect event');
      // Dispatch reconnect event to trigger subscription recovery
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      
      // Wait briefly for connection to establish
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if recovery was successful
      const newStatus = getRealtimeConnectionStatus();
      console.log('After recovery attempt, status is:', newStatus);
      
      if (newStatus === 'CONNECTED') {
        console.log('Realtime connection successfully recovered');
        toast.success('Connection restored', { duration: 3000 });
        return true;
      }
      
      console.log('Realtime connection recovery in progress...');
      return false;
    }
    
    return status === 'CONNECTED';
  } catch (error) {
    console.error('Error ensuring realtime connection:', error);
    return false;
  }
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
        toast.success('Connection restored', { 
          description: 'Real-time updates active',
          duration: 3000
        });
      } else {
        toast.warning('Connection lost', {
          description: 'Attempting to reconnect...',
          duration: 5000
        });
      }
    }
    
    // If disconnected, try recovery
    if (!currentStatus) {
      await ensureRealtimeConnection();
    }
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(checkInterval);
}

/**
 * Force refresh all subscriptions for the given tables
 * @param tables List of table names to refresh
 */
export async function forceRefreshSubscriptions(tables: string[]): Promise<boolean> {
  try {
    // Dispatch a custom event that subscription managers can listen for
    window.dispatchEvent(new CustomEvent('force-refresh-subscriptions', { 
      detail: { tables } 
    }));
    
    // Also trigger the general reconnect event
    window.dispatchEvent(new CustomEvent('supabase-reconnect'));
    
    // Wait briefly for the subscription refresh to occur
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return true;
  } catch (error) {
    console.error('Error forcing subscription refresh:', error);
    return false;
  }
}
