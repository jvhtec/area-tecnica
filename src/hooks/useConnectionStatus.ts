
import { useEffect, useState } from 'react';
import { getRealtimeConnectionStatus, ensureRealtimeConnection } from '@/lib/enhanced-supabase-client';
import { TokenManager } from '@/lib/token-manager';

/**
 * Hook to monitor connection status and provide recovery methods
 * - Monitors realtime connection status
 * - Provides recovery functions
 * - Returns connection state for UI feedback
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>(() => 
    getRealtimeConnectionStatus() === 'CONNECTED' ? 'connected' : 'disconnected'
  );
  const [lastConnected, setLastConnected] = useState<number>(Date.now());
  const [isRecovering, setIsRecovering] = useState(false);
  const tokenManager = TokenManager.getInstance();
  
  // Update status every 10 seconds
  useEffect(() => {
    const checkConnection = () => {
      const rtStatus = getRealtimeConnectionStatus();
      const newStatus = rtStatus === 'CONNECTED' 
        ? 'connected' 
        : rtStatus === 'CONNECTING' ? 'connecting' : 'disconnected';
      
      setStatus(newStatus);
      
      if (newStatus === 'connected') {
        setLastConnected(Date.now());
      }
    };
    
    // Initial check
    checkConnection();
    
    // Setup interval for checking connection
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log("Browser reports online status");
      recoverConnection();
    };
    
    const handleOffline = () => {
      console.log("Browser reports offline status");
      setStatus('disconnected');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Connection recovery function
  const recoverConnection = async () => {
    if (isRecovering) return;
    
    try {
      setIsRecovering(true);
      setStatus('connecting');
      
      // First, try to ensure realtime connection
      const connectionRecovered = await ensureRealtimeConnection();
      
      // Second, try to refresh token if needed
      const timeSinceRefresh = Date.now() - tokenManager.lastRefreshTime; // Using the public getter
      if (timeSinceRefresh > 10 * 60 * 1000) { // 10 minutes
        await tokenManager.refreshToken();
      }
      
      if (connectionRecovered) {
        window.dispatchEvent(new CustomEvent('connection-restored'));
        setStatus('connected');
        setLastConnected(Date.now());
        return true;
      } else {
        setStatus('disconnected');
        return false;
      }
    } catch (error) {
      console.error("Error recovering connection:", error);
      setStatus('disconnected');
      return false;
    } finally {
      setIsRecovering(false);
    }
  };

  return {
    status,
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    isDisconnected: status === 'disconnected',
    lastConnected,
    timeSinceLastConnection: Date.now() - lastConnected,
    recoverConnection,
    isRecovering
  };
}
