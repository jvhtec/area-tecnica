
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";
import { toast } from "sonner";
import { connectionConfig, ConnectionConfig } from "@/lib/connection-config";
import { throttle, debounce } from "lodash";

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
  private reconnectAttempts = 0;
  private connectionEventThrottled: (state: 'connected' | 'connecting' | 'disconnected') => void;
  private lastConnectionEvent = Date.now();
  private isRefreshing = false;
  
  // Constructor is now private - use getInstance() to access
  private constructor() {
    this.tokenManager = TokenManager.getInstance();
    
    // Create throttled version of setConnectionState
    this.connectionEventThrottled = throttle(
      (state: 'connected' | 'connecting' | 'disconnected') => {
        this.setConnectionStateInternal(state);
      }, 
      connectionConfig.get().throttleConnectionEventsMs
    );
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
    const config = connectionConfig.get();
    
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
      this.logDebug("[ConnectionManager] Token refreshed, validating connections");
      this.validateConnections();
    });
    
    // Log initialization with current config
    this.logDebug("[ConnectionManager] Initialized with config:", config);
  }
  
  /**
   * Enhanced logging with debug mode support
   */
  private logDebug(...args: any[]): void {
    const config = connectionConfig.get();
    if (config.debugMode) {
      console.log(...args);
    }
  }
  
  /**
   * Set up visibility change detection
   */
  private setupVisibilityDetection(): void {
    if (this.visibilityDetectionEnabled) return;
    this.visibilityDetectionEnabled = true;
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.logDebug("[ConnectionManager] Visibility detection enabled");
  }
  
  /**
   * Handle visibility change events with debouncing
   */
  private handleVisibilityChange = debounce((): void => {
    if (document.visibilityState === 'visible') {
      this.logDebug("[ConnectionManager] Document became visible");
      
      // Calculate time since last activity
      const inactivityDuration = Date.now() - this.lastActiveTimestamp;
      const config = connectionConfig.get();
      
      if (inactivityDuration > config.inactivityThresholdMs) {
        this.logDebug(`[ConnectionManager] Page was inactive for ${Math.round(inactivityDuration / 1000)}s, refreshing connections`);
        
        // Force a complete connection validation
        this.validateConnections(true);
        
        // Show a toast notification if not in quiet mode
        if (config.showReconnectNotifications && !config.quietMode) {
          toast.info("Refreshing data after inactivity", {
            description: "Reconnecting to real-time updates..."
          });
        }
        
        // Invalidate all queries to refresh data
        this.queryClient?.invalidateQueries();
      }
      
      // Update last active timestamp
      this.lastActiveTimestamp = Date.now();
    }
  }, 500);
  
  /**
   * Set up network status detection
   */
  private setupNetworkDetection(): void {
    if (this.networkDetectionEnabled) return;
    this.networkDetectionEnabled = true;
    
    // Handle online event
    window.addEventListener('online', () => {
      this.logDebug("[ConnectionManager] Network came online");
      this.validateConnections(true);
      
      const config = connectionConfig.get();
      if (config.showReconnectNotifications && !config.quietMode) {
        toast.success("Network connection restored", {
          description: "Reconnecting to real-time updates..."
        });
      }
    });
    
    // Handle offline event
    window.addEventListener('offline', () => {
      this.logDebug("[ConnectionManager] Network went offline");
      this.setConnectionState('disconnected');
      
      const config = connectionConfig.get();
      if (config.showReconnectNotifications) {
        toast.error("Network connection lost", {
          description: "Waiting for reconnection..."
        });
      }
    });
    
    this.logDebug("[ConnectionManager] Network detection enabled");
  }
  
  /**
   * Start the heartbeat system
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
    }
    
    const config = connectionConfig.get();
    
    // Set up interval for sending heartbeats
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, config.heartbeatIntervalMs);
    
    // Send an initial heartbeat
    this.sendHeartbeat();
    
    this.logDebug("[ConnectionManager] Heartbeat system started with interval:", config.heartbeatIntervalMs);
  }
  
  /**
   * Send a heartbeat to check connection status with exponential backoff
   */
  private async sendHeartbeat(): Promise<void> {
    const config = connectionConfig.get();
    
    try {
      // Only send heartbeat if the document is visible or we've exceeded background refresh interval
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatResponse;
      if (document.visibilityState === 'visible' || 
          timeSinceLastHeartbeat > config.inactivityThresholdMs) {
        
        this.logDebug("[ConnectionManager] Sending heartbeat");
        
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
          this.reconnectAttempts = 0;
          
          // If we were previously disconnected, reconnect
          if (this.connectionState !== 'connected') {
            this.setConnectionState('connected');
          }
        } else {
          if (config.verboseLogging) {
            console.warn("[ConnectionManager] Failed heartbeat:", response.status);
          }
          this.consecutiveFailedHeartbeats++;
          
          // If we've had too many consecutive failed heartbeats, force reconnect
          if (this.consecutiveFailedHeartbeats >= config.maxConsecutiveFailedHeartbeats) {
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
      if (this.consecutiveFailedHeartbeats >= config.maxConsecutiveFailedHeartbeats) {
        this.setConnectionState('disconnected');
      }
      
      // Apply exponential backoff for reconnect attempts
      this.reconnectAttempts++;
      const backoffTime = Math.min(
        config.reconnectBackoffBaseMs * Math.pow(2, this.reconnectAttempts - 1),
        config.reconnectBackoffMaxMs
      );
      
      // Add jitter to avoid thundering herd
      const jitter = config.reconnectJitterFactor * backoffTime * (Math.random() * 2 - 1);
      const nextBackoff = backoffTime + jitter;
      
      this.logDebug(`[ConnectionManager] Backoff for ${Math.round(nextBackoff / 1000)}s before next reconnect attempt`);
    }
  }
  
  /**
   * Start health check system
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      window.clearInterval(this.healthCheckInterval);
    }
    
    const config = connectionConfig.get();
    
    // Set up interval for health checks
    this.healthCheckInterval = window.setInterval(() => {
      this.checkConnectionHealth();
    }, config.healthCheckIntervalMs);
    
    this.logDebug("[ConnectionManager] Health check system started with interval:", config.healthCheckIntervalMs);
  }
  
  /**
   * Check connection health
   */
  private checkConnectionHealth(): void {
    // Skip checks if document isn't visible
    if (document.visibilityState !== 'visible') return;
    
    const config = connectionConfig.get();
    
    // Check if heartbeat is stale
    const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatResponse;
    if (timeSinceLastHeartbeat > config.connectionTimeoutMs) {
      console.warn(`[ConnectionManager] No heartbeat response for ${Math.round(timeSinceLastHeartbeat / 1000)}s, connection may be dead`);
      
      // Try to reconnect if not already refreshing
      if (!this.isRefreshing) {
        this.setConnectionState('connecting');
        this.validateConnections(true);
      }
    }
    
    // Check if we should refresh session
    const timeSinceLastActive = Date.now() - this.lastActiveTimestamp;
    if (timeSinceLastActive > config.staleDataThresholdMs) {
      this.logDebug(`[ConnectionManager] Session may be stale after ${Math.round(timeSinceLastActive / 1000)}s of inactivity`);
      
      // Refresh session using token manager
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.tokenManager.refreshToken()
          .catch(error => {
            console.error("[ConnectionManager] Failed to refresh token:", error);
          })
          .finally(() => {
            this.isRefreshing = false;
          });
      }
    }
    
    // Update the last active timestamp if the document is visible
    if (document.visibilityState === 'visible') {
      this.lastActiveTimestamp = Date.now();
    }
  }
  
  /**
   * Internal method to set connection state without throttling
   */
  private setConnectionStateInternal(state: 'connected' | 'connecting' | 'disconnected'): void {
    // Skip if state hasn't changed
    if (this.connectionState === state) return;
    
    this.logDebug(`[ConnectionManager] Connection state changed: ${this.connectionState} -> ${state}`);
    
    // Update state
    this.connectionState = state;
    this.lastConnectionEvent = Date.now();
    
    // Notify all listeners
    this.notifyListeners();
  }
  
  /**
   * Set the connection state and notify listeners with throttling
   */
  private setConnectionState(state: 'connected' | 'connecting' | 'disconnected'): void {
    // Use the throttled version of setConnectionState
    this.connectionEventThrottled(state);
  }
  
  /**
   * Validate all connections and reestablish if needed
   */
  public validateConnections(force: boolean = false): void {
    if (!this.queryClient) {
      console.warn("[ConnectionManager] Cannot validate connections, QueryClient not initialized");
      return;
    }
    
    this.logDebug(`[ConnectionManager] Validating connections${force ? ' (forced)' : ''}`);
    
    // Avoid concurrent refreshes
    if (this.isRefreshing) {
      this.logDebug("[ConnectionManager] Already refreshing, skipping validation");
      return;
    }
    
    this.isRefreshing = true;
    
    // Check session first
    if (force) {
      // Force refresh the auth session
      this.tokenManager.refreshToken()
        .then(() => {
          // Check channel connections
          this.validateChannelConnections(force);
        })
        .catch(error => {
          console.error("[ConnectionManager] Failed to refresh session:", error);
          this.validateChannelConnections(force);
        })
        .finally(() => {
          this.isRefreshing = false;
        });
    } else {
      // Just validate the channels without refreshing the session
      this.validateChannelConnections(force);
      this.isRefreshing = false;
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
        this.logDebug("[ConnectionManager] No channels to validate");
        return;
      }
      
      this.logDebug(`[ConnectionManager] Validating ${channels.length} channels`);
      
      // If force is true, remove all channels and re-subscribe
      if (force) {
        // Remove all channels
        channels.forEach(channel => {
          try {
            this.logDebug(`[ConnectionManager] Removing channel ${channel.topic}`);
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
              this.logDebug(`[ConnectionManager] Removing broken channel ${channel.topic}`);
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
          this.logDebug("[ConnectionManager] All channels are connected");
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
    const config = connectionConfig.get();
    
    return {
      state: this.connectionState,
      lastActiveTimestamp: this.lastActiveTimestamp,
      lastHeartbeatResponse: this.lastHeartbeatResponse,
      isStale: (Date.now() - this.lastHeartbeatResponse) > config.staleDataThresholdMs,
      timeSinceLastEvent: Date.now() - this.lastConnectionEvent
    };
  }
  
  /**
   * Force a manual refresh of all connections and data
   */
  public forceRefresh(): void {
    this.logDebug("[ConnectionManager] Forcing refresh of all connections and data");
    
    const config = connectionConfig.get();
    
    // Show toast notification if not in quiet mode
    if (config.showReconnectNotifications && !config.quietMode) {
      toast.info("Refreshing all connections", {
        description: "Reconnecting to real-time updates..."
      });
    }
    
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
    
    this.logDebug("[ConnectionManager] Cleaned up resources");
  }
  
  /**
   * Update connection manager settings
   */
  public updateSettings(settings: Partial<ConnectionConfig>): ConnectionConfig {
    const updatedConfig = connectionConfig.update(settings);
    
    this.logDebug("[ConnectionManager] Settings updated:", updatedConfig);
    
    // Restart systems with new configurations
    this.startHeartbeat();
    this.startHealthCheck();
    
    return updatedConfig;
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
  timeSinceLastEvent: number;
}

// Export singleton instance
export const connectionManager = ConnectionManager.getInstance();

// Hook for components to use connection manager
export function useConnectionManager() {
  return connectionManager;
}
