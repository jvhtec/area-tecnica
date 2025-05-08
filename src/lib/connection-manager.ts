
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";
import { toast } from "sonner";

/**
 * ConnectionManager orchestrates network connectivity, subscriptions and authentication
 * to ensure consistent real-time data flow even during periods of inactivity
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private queryClient: QueryClient | null = null;
  private heartbeatInterval: number | null = null;
  private visibilityDetectionEnabled = false;
  private networkDetectionEnabled = false;
  private lastActiveTimestamp = Date.now();
  private lastHeartbeatResponse = Date.now();
  private connectionState: 'connected' | 'connecting' | 'disconnected' = 'connecting';
  private healthCheckInterval: number | null = null;
  private tokenManager: TokenManager;
  private listeners: Array<(status: ConnectionStatus) => void> = [];
  private consecutiveFailedHeartbeats = 0;
  
  // Adjustable settings with sensible defaults
  private settings = {
    heartbeatIntervalMs: 30000, // 30 seconds between heartbeats
    healthCheckIntervalMs: 10000, // 10 seconds between health checks
    connectionTimeoutMs: 60000, // 1 minute to consider connection dead
    maxConsecutiveFailedHeartbeats: 3, // After this many failed heartbeats, force reconnect
    inactivityThresholdMs: 3 * 60 * 1000, // 3 minutes of inactivity before refreshing
    backgroundRefreshIntervalMs: 4 * 60 * 1000, // 4 minutes between background refreshes
    staleDataThresholdMs: 5 * 60 * 1000, // 5 minutes before considering data stale
    reconnectBackoffBaseMs: 2000, // Start with 2 seconds for reconnect attempts
    reconnectBackoffMaxMs: 60000, // Max 1 minute between reconnect attempts
    reconnectJitterFactor: 0.2 // 20% random jitter to avoid thundering herd problem
  };
  
  private constructor() {
    this.tokenManager = TokenManager.getInstance();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }
  
  /**
   * Initialize the connection manager with a query client
   */
  public initialize(queryClient: QueryClient): void {
    this.queryClient = queryClient;
    
    // Start heartbeat system
    this.startHeartbeat();
    
    // Set up visibility detection
    this.setupVisibilityDetection();
    
    // Set up network detection
    this.setupNetworkDetection();
    
    // Start health check system
    this.startHealthCheck();
    
    // Subscribe to token refresh events to handle auth-related reconnects
    this.tokenManager.subscribe(() => {
      console.log("[ConnectionManager] Token refreshed, validating connections");
      this.validateConnections();
    });
    
    // Log initialization
    console.log("[ConnectionManager] Initialized");
  }
  
  /**
   * Set up visibility change detection
   */
  private setupVisibilityDetection(): void {
    if (this.visibilityDetectionEnabled) return;
    this.visibilityDetectionEnabled = true;
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    console.log("[ConnectionManager] Visibility detection enabled");
  }
  
  /**
   * Handle visibility change events
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      console.log("[ConnectionManager] Document became visible");
      
      // Calculate time since last activity
      const inactivityDuration = Date.now() - this.lastActiveTimestamp;
      
      if (inactivityDuration > this.settings.inactivityThresholdMs) {
        console.log(`[ConnectionManager] Page was inactive for ${Math.round(inactivityDuration / 1000)}s, refreshing connections`);
        
        // Force a complete connection validation
        this.validateConnections(true);
        
        // Show a toast notification
        toast.info("Refreshing data after inactivity", {
          description: "Reconnecting to real-time updates..."
        });
        
        // Invalidate all queries to refresh data
        this.queryClient?.invalidateQueries();
      }
      
      // Update last active timestamp
      this.lastActiveTimestamp = Date.now();
    }
  };
  
  /**
   * Set up network status detection
   */
  private setupNetworkDetection(): void {
    if (this.networkDetectionEnabled) return;
    this.networkDetectionEnabled = true;
    
    // Handle online event
    window.addEventListener('online', () => {
      console.log("[ConnectionManager] Network came online");
      this.validateConnections(true);
      toast.success("Network connection restored", {
        description: "Reconnecting to real-time updates..."
      });
    });
    
    // Handle offline event
    window.addEventListener('offline', () => {
      console.log("[ConnectionManager] Network went offline");
      this.setConnectionState('disconnected');
      toast.error("Network connection lost", {
        description: "Waiting for reconnection..."
      });
    });
    
    console.log("[ConnectionManager] Network detection enabled");
  }
  
  /**
   * Start the heartbeat system
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
    }
    
    // Set up interval for sending heartbeats
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.settings.heartbeatIntervalMs);
    
    // Send an initial heartbeat
    this.sendHeartbeat();
    
    console.log("[ConnectionManager] Heartbeat system started");
  }
  
  /**
   * Send a heartbeat to check connection status
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      // Only send heartbeat if the document is visible or we've exceeded background refresh interval
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatResponse;
      if (document.visibilityState === 'visible' || 
          timeSinceLastHeartbeat > this.settings.backgroundRefreshIntervalMs) {
        
        console.log("[ConnectionManager] Sending heartbeat");
        
        // Use Supabase REST API for heartbeat
        const response = await fetch('https://syldobdcdsgfgjtbuwxm.supabase.co/rest/v1/', {
          method: 'HEAD',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5bGRvYmRjZHNnZmdqdGJ1d3htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NDE1ODcsImV4cCI6MjA1MTUxNzU4N30.iLtE6_xC0FE21JKzy77UPAvferh4l1WeLvvVCn15YJc',
            'Cache-Control': 'no-cache',
          },
        });
        
        // Update heartbeat status based on response
        if (response.ok) {
          this.lastHeartbeatResponse = Date.now();
          this.consecutiveFailedHeartbeats = 0;
          
          // If we were previously disconnected, reconnect
          if (this.connectionState !== 'connected') {
            this.setConnectionState('connected');
          }
        } else {
          console.warn("[ConnectionManager] Failed heartbeat:", response.status);
          this.consecutiveFailedHeartbeats++;
          
          // If we've had too many consecutive failed heartbeats, force reconnect
          if (this.consecutiveFailedHeartbeats >= this.settings.maxConsecutiveFailedHeartbeats) {
            console.error("[ConnectionManager] Too many failed heartbeats, forcing reconnection");
            this.validateConnections(true);
            this.consecutiveFailedHeartbeats = 0;
          }
        }
      }
    } catch (error) {
      console.error("[ConnectionManager] Heartbeat error:", error);
      this.consecutiveFailedHeartbeats++;
      
      // If we've had too many consecutive failures, set to disconnected
      if (this.consecutiveFailedHeartbeats >= this.settings.maxConsecutiveFailedHeartbeats) {
        this.setConnectionState('disconnected');
      }
    }
  }
  
  /**
   * Start health check system
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      window.clearInterval(this.healthCheckInterval);
    }
    
    // Set up interval for health checks
    this.healthCheckInterval = window.setInterval(() => {
      this.checkConnectionHealth();
    }, this.settings.healthCheckIntervalMs);
    
    console.log("[ConnectionManager] Health check system started");
  }
  
  /**
   * Check connection health
   */
  private checkConnectionHealth(): void {
    // Skip checks if document isn't visible
    if (document.visibilityState !== 'visible') return;
    
    // Check if heartbeat is stale
    const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatResponse;
    if (timeSinceLastHeartbeat > this.settings.connectionTimeoutMs) {
      console.warn(`[ConnectionManager] No heartbeat response for ${Math.round(timeSinceLastHeartbeat / 1000)}s, connection may be dead`);
      
      // Try to reconnect
      this.setConnectionState('connecting');
      this.validateConnections(true);
    }
    
    // Check if we should refresh session
    const timeSinceLastActive = Date.now() - this.lastActiveTimestamp;
    if (timeSinceLastActive > this.settings.staleDataThresholdMs) {
      console.log(`[ConnectionManager] Session may be stale after ${Math.round(timeSinceLastActive / 1000)}s of inactivity`);
      
      // Refresh session
      this.tokenManager.refreshSession();
    }
    
    // Update the last active timestamp if the document is visible
    if (document.visibilityState === 'visible') {
      this.lastActiveTimestamp = Date.now();
    }
  }
  
  /**
   * Set the connection state and notify listeners
   */
  private setConnectionState(state: 'connected' | 'connecting' | 'disconnected'): void {
    // Skip if state hasn't changed
    if (this.connectionState === state) return;
    
    console.log(`[ConnectionManager] Connection state changed: ${this.connectionState} -> ${state}`);
    
    // Update state
    this.connectionState = state;
    
    // Notify all listeners
    this.notifyListeners();
  }
  
  /**
   * Validate all connections and reestablish if needed
   */
  public validateConnections(force: boolean = false): void {
    if (!this.queryClient) {
      console.warn("[ConnectionManager] Cannot validate connections, QueryClient not initialized");
      return;
    }
    
    console.log(`[ConnectionManager] Validating connections${force ? ' (forced)' : ''}`);
    
    // Check session first
    if (force) {
      // Force refresh the auth session
      this.tokenManager.refreshSession()
        .then(() => {
          // Check channel connections
          this.validateChannelConnections(force);
        })
        .catch(error => {
          console.error("[ConnectionManager] Failed to refresh session:", error);
          this.validateChannelConnections(force);
        });
    } else {
      // Just validate the channels without refreshing the session
      this.validateChannelConnections(force);
    }
  }
  
  /**
   * Validate channel connections
   */
  private validateChannelConnections(force: boolean = false): void {
    try {
      // Get all current channels
      const channels = supabase.getChannels();
      
      if (channels.length === 0) {
        console.log("[ConnectionManager] No channels to validate");
        return;
      }
      
      console.log(`[ConnectionManager] Validating ${channels.length} channels`);
      
      // If force is true, remove all channels and re-subscribe
      if (force) {
        // Remove all channels
        channels.forEach(channel => {
          try {
            console.log(`[ConnectionManager] Removing channel ${channel.topic}`);
            supabase.removeChannel(channel);
          } catch (error) {
            console.error(`[ConnectionManager] Error removing channel ${channel.topic}:`, error);
          }
        });
        
        // Dispatch reconnect event for components to resubscribe
        window.dispatchEvent(new CustomEvent('supabase-reconnect'));
        
        // Invalidate all queries
        this.queryClient?.invalidateQueries();
        
        // Update connection state
        this.setConnectionState('connected');
      } else {
        // Just check channel states
        const brokenChannels = channels.filter(channel => channel.state !== 'joined');
        
        if (brokenChannels.length > 0) {
          console.warn(`[ConnectionManager] Found ${brokenChannels.length} broken channels, reconnecting`);
          
          // Remove broken channels
          brokenChannels.forEach(channel => {
            try {
              console.log(`[ConnectionManager] Removing broken channel ${channel.topic}`);
              supabase.removeChannel(channel);
            } catch (error) {
              console.error(`[ConnectionManager] Error removing broken channel ${channel.topic}:`, error);
            }
          });
          
          // Dispatch reconnect event for components to resubscribe
          window.dispatchEvent(new CustomEvent('supabase-reconnect'));
          
          // Invalidate queries
          this.queryClient?.invalidateQueries();
        } else {
          console.log("[ConnectionManager] All channels are connected");
          this.setConnectionState('connected');
        }
      }
    } catch (error) {
      console.error("[ConnectionManager] Error validating channel connections:", error);
    }
  }
  
  /**
   * Register a connection state listener
   */
  public registerListener(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Immediately notify with current state
    listener(this.getConnectionStatus());
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners of the connection state
   */
  private notifyListeners(): void {
    const status = this.getConnectionStatus();
    this.listeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error("[ConnectionManager] Error in connection listener:", error);
      }
    });
  }
  
  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return {
      state: this.connectionState,
      lastActiveTimestamp: this.lastActiveTimestamp,
      lastHeartbeatResponse: this.lastHeartbeatResponse,
      isStale: (Date.now() - this.lastHeartbeatResponse) > this.settings.staleDataThresholdMs
    };
  }
  
  /**
   * Force a manual refresh of all connections and data
   */
  public forceRefresh(): void {
    console.log("[ConnectionManager] Forcing refresh of all connections and data");
    
    // Show toast notification
    toast.info("Refreshing all connections", {
      description: "Reconnecting to real-time updates..."
    });
    
    // Refresh connections
    this.validateConnections(true);
    
    // Update timestamp
    this.lastActiveTimestamp = Date.now();
  }
  
  /**
   * Clean up resources when the module is unloaded
   */
  public cleanup(): void {
    // Clear intervals
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.healthCheckInterval) {
      window.clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    
    console.log("[ConnectionManager] Cleaned up resources");
  }
  
  /**
   * Update connection manager settings
   */
  public updateSettings(settings: Partial<typeof this.settings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log("[ConnectionManager] Settings updated:", this.settings);
  }
}

/**
 * Connection status interface
 */
export interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'disconnected';
  lastActiveTimestamp: number;
  lastHeartbeatResponse: number;
  isStale: boolean;
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();

// Hook for components to use connection manager
export function useConnectionManager() {
  return connectionManager;
}
