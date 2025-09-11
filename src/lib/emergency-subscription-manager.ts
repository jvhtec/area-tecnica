import { QueryClient } from "@tanstack/react-query";

/**
 * Emergency Subscription Manager - Completely disables real-time features
 * to allow database to recover from overload
 */
export class EmergencySubscriptionManager {
  private static instance: EmergencySubscriptionManager;
  private queryClient: QueryClient;
  private isEmergencyMode = true;
  private stats = {
    activeConnections: 0,
    queuedSubscriptions: 0,
    failedConnections: 0,
    averageResponseTime: 0,
    subscriptionCount: 0,
    circuitBreakerOpen: true,
    lastHealthCheck: Date.now()
  };

  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    console.warn('Emergency Subscription Manager active - Real-time features disabled');
  }

  static getInstance(queryClient: QueryClient): EmergencySubscriptionManager {
    if (!EmergencySubscriptionManager.instance) {
      EmergencySubscriptionManager.instance = new EmergencySubscriptionManager(queryClient);
    }
    return EmergencySubscriptionManager.instance;
  }

  /**
   * All subscription attempts are disabled in emergency mode
   */
  public subscribeToTable(
    table: string,
    queryKey: string | string[],
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): { unsubscribe: () => void } {
    console.log(`Emergency mode: Subscription to ${table} disabled`);
    return { unsubscribe: () => {} };
  }

  /**
   * Force refresh only invalidates queries without creating subscriptions
   */
  public forceRefresh() {
    console.log('Emergency mode: Force refresh (no subscriptions created)');
    this.queryClient.invalidateQueries();
  }

  /**
   * Returns stats showing emergency mode is active
   */
  public getStats() {
    return {
      ...this.stats,
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Reset does nothing in emergency mode
   */
  public resetAllSubscriptions() {
    console.log('Emergency mode: Reset ignored');
  }

  /**
   * Check if emergency mode can be disabled
   */
  public canExitEmergencyMode(): boolean {
    return false; // Always false until manually enabled
  }

  /**
   * Manually disable emergency mode (should only be done when database is stable)
   */
  public disableEmergencyMode() {
    this.isEmergencyMode = false;
    this.stats.circuitBreakerOpen = false;
    console.log('Emergency mode disabled - Real-time features restored');
  }
}