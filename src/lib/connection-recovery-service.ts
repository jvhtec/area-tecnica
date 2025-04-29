
import { supabase, checkNetworkConnection } from './enhanced-supabase-client';
import { toast } from "sonner";

class ConnectionRecoveryService {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 2000; // 2 seconds
  private maxReconnectDelay = 60000; // 1 minute
  private reconnectTimeoutId: number | null = null;
  private isRecovering = false;
  private lastNotificationTime = 0;
  private notificationCooldown = 15000; // 15 seconds between notifications
  
  constructor() {
    this.setupNetworkListeners();
  }
  
  private setupNetworkListeners() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.handleNetworkRecovery();
    });
    
    window.addEventListener('offline', () => {
      this.handleNetworkDisconnection();
    });
    
    // Listen for visibility changes (tab focus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkConnection();
      }
    });
  }
  
  private handleNetworkRecovery() {
    console.log("Network connection recovered, checking WebSockets");
    
    // Reset reconnect attempts when network recovers
    this.reconnectAttempts = 0;
    
    // Show notification with cooldown
    this.showConnectionNotification('Network connection restored, reconnecting...', 'success');
    
    // Start recovery process
    this.startRecovery();
  }
  
  private handleNetworkDisconnection() {
    console.log("Network connection lost");
    
    // Show notification
    this.showConnectionNotification('Network connection lost', 'error');
    
    // Clear any pending reconnect attempts
    if (this.reconnectTimeoutId) {
      window.clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
  
  private async checkConnection() {
    console.log("Checking connection status");
    
    try {
      // Check if we have a network connection
      const hasNetwork = await checkNetworkConnection();
      
      if (!hasNetwork) {
        console.log("No network connection detected");
        return;
      }
      
      // Check if any realtime channels are disconnected
      const channels = supabase.getChannels();
      const hasDisconnectedChannels = channels.some(channel => 
        channel.state !== 'joined'
      );
      
      if (hasDisconnectedChannels) {
        console.log("Detected disconnected channels, starting recovery");
        this.startRecovery();
      }
    } catch (error) {
      console.error("Error checking connection:", error);
    }
  }
  
  private showConnectionNotification(message: string, type: 'success' | 'error' | 'info') {
    const now = Date.now();
    
    // Limit notification frequency
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      return;
    }
    
    this.lastNotificationTime = now;
    
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  }
  
  startRecovery() {
    // Don't start multiple recovery processes
    if (this.isRecovering) {
      return;
    }
    
    this.isRecovering = true;
    
    this.attemptReconnect();
  }
  
  private async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      this.showConnectionNotification(
        'Unable to restore connection after multiple attempts', 
        'error'
      );
      this.isRecovering = false;
      return;
    }
    
    try {
      console.log(`Reconnection attempt ${this.reconnectAttempts + 1}`);
      
      // Check network before attempting reconnect
      const hasNetwork = await checkNetworkConnection();
      
      if (!hasNetwork) {
        console.log("No network connection, delaying reconnect");
        this.scheduleNextReconnect();
        return;
      }
      
      // Get all active channels
      const channels = supabase.getChannels();
      
      if (channels.length === 0) {
        console.log("No channels to reconnect");
        this.isRecovering = false;
        return;
      }
      
      // Remove all channels and recreate them
      channels.forEach(channel => {
        try {
          console.log(`Removing channel: ${channel.topic}`);
          supabase.removeChannel(channel);
        } catch (error) {
          console.error(`Error removing channel ${channel.topic}:`, error);
        }
      });
      
      // Signal success
      this.reconnectAttempts = 0;
      this.isRecovering = false;
      
      // Show success notification if this was a recovery (not initial connection)
      if (this.reconnectAttempts > 0) {
        this.showConnectionNotification('Connection restored', 'success');
      }
      
      // Broadcast a custom event so components can refresh their subscriptions
      window.dispatchEvent(new CustomEvent('supabase-reconnect'));
      
    } catch (error) {
      console.error("Error during reconnection:", error);
      this.scheduleNextReconnect();
    }
  }
  
  private scheduleNextReconnect() {
    // Clear any existing timeout
    if (this.reconnectTimeoutId) {
      window.clearTimeout(this.reconnectTimeoutId);
    }
    
    // Calculate delay with exponential backoff and jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts) * (0.9 + Math.random() * 0.2),
      this.maxReconnectDelay
    );
    
    console.log(`Scheduling next reconnect attempt in ${Math.round(delay / 1000)}s`);
    
    this.reconnectAttempts++;
    
    // Schedule next attempt
    this.reconnectTimeoutId = window.setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }
}

// Export singleton instance
export const connectionRecovery = new ConnectionRecoveryService();

// Export a hook for components to use
export function useConnectionRecovery() {
  return {
    startRecovery: () => connectionRecovery.startRecovery(),
  };
}
