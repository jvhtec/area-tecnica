
/**
 * Configuration for the connection manager and subscription systems
 * Centralizes all settings to make tuning and debugging easier
 */

// Configuration system for connection and subscription settings
export interface ConnectionConfig {
  // Connection health check settings
  heartbeatIntervalMs: number;       // Time between heartbeat checks
  healthCheckIntervalMs: number;     // Time between health validations
  connectionTimeoutMs: number;       // Time to consider connection dead
  
  // Subscription settings
  inactivityThresholdMs: number;     // Time before refreshing after inactivity
  staleDataThresholdMs: number;      // Time before considering data stale

  // Reconnection settings
  maxConsecutiveFailedHeartbeats: number;  // After this many failures, force reconnect
  reconnectBackoffBaseMs: number;          // Starting backoff interval
  reconnectBackoffMaxMs: number;           // Maximum backoff interval
  reconnectJitterFactor: number;           // Random jitter to avoid thundering herd
  throttleConnectionEventsMs: number;      // Minimum time between connection status changes
  
  // UI settings
  showConnectionIndicator: boolean;   // Whether to show connection indicator
  showReconnectNotifications: boolean; // Show toast notifications on reconnect
  quietMode: boolean;                 // Suppress non-critical notifications
  
  // Debug settings
  debugMode: boolean;                 // Enable additional logging
  verboseLogging: boolean;           // Log all connection events
}

// Default configuration with optimized settings
export const defaultConnectionConfig: ConnectionConfig = {
  // Less frequent checking to reduce overhead
  heartbeatIntervalMs: 60000,         // 60 seconds between heartbeats (was 30s)
  healthCheckIntervalMs: 30000,       // 30 seconds between health checks (was 10s)
  connectionTimeoutMs: 90000,         // 90 seconds to consider connection dead (was 60s)
  
  // Longer thresholds to reduce unnecessary refreshes
  inactivityThresholdMs: 5 * 60 * 1000,  // 5 minutes before refresh after inactivity (was 3m)
  staleDataThresholdMs: 10 * 60 * 1000,  // 10 minutes before considering data stale (was 5m)
  
  // More robust reconnection handling
  maxConsecutiveFailedHeartbeats: 3,
  reconnectBackoffBaseMs: 3000,       // Start with 3 seconds (was 2s)
  reconnectBackoffMaxMs: 120000,      // Max 2 minutes between reconnects (was 1m)
  reconnectJitterFactor: 0.2,
  throttleConnectionEventsMs: 5000,   // Minimum 5 seconds between connection status changes
  
  // UI settings
  showConnectionIndicator: true,
  showReconnectNotifications: true,
  quietMode: false,
  
  // Debug settings
  debugMode: false,
  verboseLogging: false
};

// User settings that override the defaults
let userConnectionConfig: Partial<ConnectionConfig> = {};

/**
 * Get the current connection configuration (defaults + user overrides)
 */
export function getConnectionConfig(): ConnectionConfig {
  return { ...defaultConnectionConfig, ...userConnectionConfig };
}

/**
 * Update user connection configuration
 */
export function updateConnectionConfig(config: Partial<ConnectionConfig>): ConnectionConfig {
  userConnectionConfig = { ...userConnectionConfig, ...config };
  return getConnectionConfig();
}

/**
 * Reset user connection configuration to defaults
 */
export function resetConnectionConfig(): ConnectionConfig {
  userConnectionConfig = {};
  return getConnectionConfig();
}

/**
 * Enable or disable debug mode
 */
export function setDebugMode(enabled: boolean): void {
  userConnectionConfig = { ...userConnectionConfig, debugMode: enabled };
  if (enabled) {
    console.log('[ConnectionConfig] Debug mode enabled');
  }
}

/**
 * Enable or disable quiet mode (fewer notifications)
 */
export function setQuietMode(enabled: boolean): void {
  userConnectionConfig = { ...userConnectionConfig, quietMode: enabled };
}

// Export a singleton instance for global access
export const connectionConfig = {
  get: getConnectionConfig,
  update: updateConnectionConfig,
  reset: resetConnectionConfig,
  setDebugMode,
  setQuietMode
};
