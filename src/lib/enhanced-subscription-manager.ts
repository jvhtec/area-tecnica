
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

type SubscriptionStatus = {
  isConnected: boolean;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: number;
  errorCount: number;
};

// Singleton manager for enhanced subscription handling with health monitoring
export class EnhancedSubscriptionManager {
  private static instance: EnhancedSubscriptionManager | null = null;
  private queryClient: QueryClient;
  private subscriptions: Map<string, { 
    channel: RealtimeChannel; 
    status: SubscriptionStatus;
    lastEvent: number;
    priority: 'high' | 'medium' | 'low';
    queryKey: string | string[];
  }> = new Map();
  
  // Map of routes to their subscriptions for cleanup
  private routeSubscriptions: Map<string, Set<string>> = new Map();
  
  // Health check interval
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // Connection status
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'connecting';
  
  // Private constructor for singleton pattern
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupHealthCheck();
    this.monitorNetworkStatus();
  }
  
  // Get singleton instance
  static getInstance(queryClient: QueryClient): EnhancedSubscriptionManager {
    if (!EnhancedSubscriptionManager.instance) {
      EnhancedSubscriptionManager.instance = new EnhancedSubscriptionManager(queryClient);
    }
    return EnhancedSubscriptionManager.instance;
  }
  
  // Set up health check interval
  private setupHealthCheck() {
    // Clear existing interval if any
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Set up new health check interval
    this.healthCheckInterval = setInterval(() => {
      this.checkSubscriptionHealth();
    }, 30000); // Check every 30 seconds
  }
  
  // Check health of all subscriptions
  private checkSubscriptionHealth() {
    console.log(`Health check: Monitoring ${this.subscriptions.size} subscriptions`);
    
    const now = Date.now();
    let needsReconnect = false;
    
    // Check each subscription
    this.subscriptions.forEach((sub, key) => {
      // If a high priority subscription has been inactive for more than 5 minutes
      if (sub.priority === 'high' && now - sub.lastEvent > 5 * 60 * 1000) {
        console.log(`Stale high-priority subscription detected for ${key}, needs reconnect`);
        needsReconnect = true;
        sub.status.errorCount += 1;
        sub.status.status = 'error';
      }
      // If a medium priority subscription has been inactive for more than 10 minutes
      else if (sub.priority === 'medium' && now - sub.lastEvent > 10 * 60 * 1000) {
        console.log(`Stale medium-priority subscription detected for ${key}, needs reconnect`);
        needsReconnect = true;
        sub.status.errorCount += 1;
        sub.status.status = 'error';
      }
      // If any subscription has too many errors
      else if (sub.status.errorCount > 3) {
        console.log(`Subscription ${key} has too many errors, needs reconnect`);
        needsReconnect = true;
      }
    });
    
    // If any subscription needs reconnect, reconnect all
    if (needsReconnect) {
      this.reestablishAllSubscriptions();
    }
  }
  
  // Monitor network status changes
  private monitorNetworkStatus() {
    window.addEventListener('online', () => {
      console.log('Network connection restored, reestablishing subscriptions');
      this.connectionStatus = 'connecting';
      this.reestablishAllSubscriptions();
    });
    
    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this.connectionStatus = 'disconnected';
    });
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('Document became visible, checking subscriptions');
        this.checkSubscriptionHealth();
      }
    });
  }
  
  // Subscribe to table changes
  subscribeToTable(
    table: string, 
    queryKey: string | string[], 
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    },
    priority: 'high' | 'medium' | 'low' = 'medium'
  ) {
    // Generate a unique key for this subscription
    const subKey = `${table}::${typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)}`;
    
    // Return existing subscription if it exists
    if (this.subscriptions.has(subKey)) {
      console.log(`Using existing subscription for ${subKey}`);
      return {
        unsubscribe: () => { this.unsubscribeFromTable(table, queryKey); }
      };
    }
    
    console.log(`Creating new subscription for ${subKey} with ${priority} priority`);
    
    // Create a unique channel name
    const channelName = `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Set up subscription configuration
    const config: any = {
      event: filter?.event || '*',
      schema: filter?.schema || 'public',
      table
    };
    
    // Add filter if provided
    if (filter?.filter) {
      config.filter = filter.filter;
    }
    
    // Create initial status
    const status: SubscriptionStatus = {
      isConnected: false,
      status: 'connecting',
      lastActivity: Date.now(),
      errorCount: 0
    };
    
    // Create the channel
    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        config,
        (payload) => {
          console.log(`Received ${payload.eventType} for ${table}`);
          
          // Update subscription status
          const sub = this.subscriptions.get(subKey);
          if (sub) {
            sub.lastEvent = Date.now();
            sub.status.lastActivity = Date.now();
            sub.status.errorCount = 0; // Reset error count on successful event
            sub.status.status = 'connected';
            sub.status.isConnected = true;
          }
          
          // Invalidate the appropriate query
          if (Array.isArray(queryKey)) {
            this.queryClient.invalidateQueries({ queryKey });
          } else {
            this.queryClient.invalidateQueries({ queryKey: [queryKey] });
          }
        }
      )
      .on('system', { event: '*' }, (payload) => {
        console.log(`System event on channel ${channelName}:`, payload);
        
        // Update subscription status
        const sub = this.subscriptions.get(subKey);
        if (sub) {
          sub.lastEvent = Date.now();
          sub.status.lastActivity = Date.now();
          
          if (payload.type === 'connected') {
            sub.status.status = 'connected';
            sub.status.isConnected = true;
            console.log(`Channel ${channelName} connected successfully`);
          } else if (payload.type === 'disconnected') {
            sub.status.status = 'disconnected';
            sub.status.isConnected = false;
            sub.status.errorCount += 1;
            console.log(`Channel ${channelName} disconnected`);
          } else if (payload.type === 'error') {
            sub.status.status = 'error';
            sub.status.isConnected = false;
            sub.status.errorCount += 1;
            console.error(`Channel ${channelName} error:`, payload);
          }
        }
      })
      .subscribe();
    
    // Add to subscriptions map
    this.subscriptions.set(subKey, {
      channel,
      status,
      lastEvent: Date.now(),
      priority,
      queryKey
    });
    
    // Return unsubscribe function
    return {
      unsubscribe: () => { this.unsubscribeFromTable(table, queryKey); }
    };
  }
  
  // Unsubscribe from table changes
  unsubscribeFromTable(table: string, queryKey: string | string[]) {
    const subKey = `${table}::${typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)}`;
    const subscription = this.subscriptions.get(subKey);
    
    if (subscription) {
      console.log(`Unsubscribing from ${subKey}`);
      
      try {
        supabase.removeChannel(subscription.channel);
      } catch (e) {
        console.error(`Error removing channel for ${subKey}:`, e);
      }
      
      this.subscriptions.delete(subKey);
    }
  }
  
  // Register a subscription with a route
  registerRouteSubscription(route: string, subscriptionKey: string) {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
  }
  
  // Clean up subscriptions associated with a route
  cleanupRouteDependentSubscriptions(route: string) {
    const subscriptions = this.routeSubscriptions.get(route);
    
    if (subscriptions) {
      console.log(`Cleaning up ${subscriptions.size} subscriptions for route ${route}`);
      
      // Unsubscribe from each subscription
      subscriptions.forEach((subKey) => {
        const [table, queryKeyStr] = subKey.split('::');
        let queryKey: string | string[];
        
        try {
          // Try to parse as JSON array first
          queryKey = JSON.parse(queryKeyStr);
        } catch (e) {
          // If not valid JSON, use as string
          queryKey = queryKeyStr;
        }
        
        this.unsubscribeFromTable(table, queryKey);
      });
      
      // Clear route subscriptions
      this.routeSubscriptions.delete(route);
    }
  }
  
  // Reestablish all subscriptions
  reestablishAllSubscriptions() {
    console.log(`Reestablishing ${this.subscriptions.size} subscriptions`);
    
    // Create a copy of the subscriptions to avoid issues with iteration
    const subscriptionsCopy = new Map(this.subscriptions);
    
    // Clear existing subscriptions
    this.subscriptions.clear();
    
    // Resubscribe to each
    subscriptionsCopy.forEach((sub, key) => {
      const [table, queryKeyStr] = key.split('::');
      let queryKey: string | string[];
      
      try {
        // Try to parse as JSON array first
        queryKey = JSON.parse(queryKeyStr);
      } catch (e) {
        // If not valid JSON, use as string
        queryKey = queryKeyStr;
      }
      
      this.subscribeToTable(table, queryKey, undefined, sub.priority);
    });
    
    // Invalidate all queries
    this.queryClient.invalidateQueries();
  }
  
  // Reestablish a specific subscription
  reestablishSubscription(table: string, queryKey: string | string[]) {
    const subKey = `${table}::${typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)}`;
    const subscription = this.subscriptions.get(subKey);
    
    if (subscription) {
      console.log(`Reestablishing subscription for ${subKey}`);
      
      // Unsubscribe first
      try {
        supabase.removeChannel(subscription.channel);
      } catch (e) {
        console.error(`Error removing channel for ${subKey}:`, e);
      }
      
      // Remove from map
      this.subscriptions.delete(subKey);
      
      // Resubscribe
      this.subscribeToTable(table, queryKey, undefined, subscription.priority);
      
      // Invalidate related queries
      if (Array.isArray(queryKey)) {
        this.queryClient.invalidateQueries({ queryKey });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    }
  }
  
  // Get status of a specific subscription
  getSubscriptionStatus(table: string, queryKey: string | string[]): SubscriptionStatus {
    const subKey = `${table}::${typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)}`;
    const subscription = this.subscriptions.get(subKey);
    
    if (subscription) {
      return { ...subscription.status };
    }
    
    return {
      isConnected: false,
      status: 'disconnected',
      lastActivity: 0,
      errorCount: 0
    };
  }
  
  // Get summary of all subscriptions by table
  getSubscriptionsByTable(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    this.subscriptions.forEach((_, key) => {
      const [table, queryKey] = key.split('::');
      
      if (!result[table]) {
        result[table] = [];
      }
      
      result[table].push(queryKey);
    });
    
    return result;
  }
  
  // Get count of active subscriptions
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
  
  // Get list of active subscriptions
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
  
  // Get connection status
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.subscriptions.size === 0) {
      return this.connectionStatus;
    }
    
    // Check if any high priority subscription is connected
    let anyHighPriorityConnected = false;
    let anyConnected = false;
    
    this.subscriptions.forEach((sub) => {
      if (sub.status.isConnected) {
        anyConnected = true;
        
        if (sub.priority === 'high') {
          anyHighPriorityConnected = true;
        }
      }
    });
    
    if (anyHighPriorityConnected) {
      return 'connected';
    } else if (anyConnected) {
      return 'connected';
    } else {
      return 'disconnected';
    }
  }
  
  // Clean up
  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => {
      try {
        supabase.removeChannel(sub.channel);
      } catch (e) {
        console.error('Error removing channel:', e);
      }
    });
    
    this.subscriptions.clear();
    this.routeSubscriptions.clear();
  }
}
