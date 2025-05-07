import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

// This class unifies and improves upon all subscription patterns in the app
export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager | null = null;
  private queryClient: QueryClient;
  
  // Map of subscription keys to their channel
  private subscriptions: Map<string, {
    channel: RealtimeChannel;
    queryKey: string | string[];
    priority: 'high' | 'medium' | 'low';
    lastActivity: number;
    isConnected: boolean;
  }> = new Map();
  
  // Map of tables to their subscription keys
  private tableSubscriptions: Map<string, Set<string>> = new Map();
  
  // Map of routes to their subscription keys for cleanup
  private routeSubscriptions: Map<string, Set<string>> = new Map();
  
  // For connection recovery
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'connecting';
  
  // Last global activity timestamp
  private lastGlobalActivity: number = Date.now();
  
  // Private constructor for singleton pattern
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupConnectionMonitoring();
  }
  
  // Get or create singleton instance
  static getInstance(queryClient: QueryClient): UnifiedSubscriptionManager {
    if (!UnifiedSubscriptionManager.instance) {
      UnifiedSubscriptionManager.instance = new UnifiedSubscriptionManager(queryClient);
    }
    return UnifiedSubscriptionManager.instance;
  }
  
  // Monitor connection status
  private setupConnectionMonitoring() {
    // Handle online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Set up periodic health check
    setInterval(() => {
      this.checkConnectionHealth();
    }, 60000); // Check every minute
    
    // Update lastGlobalActivity on user interactions
    const updateActivity = () => {
      this.lastGlobalActivity = Date.now();
    };
    
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    
    // Special offline detector with a ping to Supabase
    setInterval(async () => {
      try {
        // Try a simple HEAD request to check connection
        // Use the API URL instead of the realtime URL directly
        const url = new URL(supabase.supabaseUrl);
        const response = await fetch(`${url.origin}/rest/v1/health`, {
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          // We're online
          if (this.connectionStatus === 'disconnected') {
            console.log('Connection restored based on health check');
            this.handleOnline();
          }
        } else {
          // We're offline
          if (this.connectionStatus === 'connected') {
            console.log('Connection lost based on health check');
            this.handleOffline();
          }
        }
      } catch (e) {
        // Error making request, probably offline
        if (this.connectionStatus === 'connected') {
          console.log('Connection lost based on health check error');
          this.handleOffline();
        }
      }
    }, 120000); // Check every 2 minutes
  }
  
  // Handle coming online
  private handleOnline() {
    console.log('Network connection detected, reconnecting subscriptions');
    this.connectionStatus = 'connecting';
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Delay reconnect to ensure network is stable
    this.reconnectTimeout = setTimeout(() => {
      this.reestablishSubscriptions();
      this.connectionStatus = 'connected';
    }, 2000);
  }
  
  // Handle going offline
  private handleOffline() {
    console.log('Network connection lost');
    this.connectionStatus = 'disconnected';
    
    // Update all subscriptions to disconnected
    this.subscriptions.forEach((sub) => {
      sub.isConnected = false;
    });
  }
  
  // Check health of all connections
  private checkConnectionHealth() {
    const now = Date.now();
    let needsReconnect = false;
    
    // Check if we've been inactive for too long
    const inactiveTime = now - this.lastGlobalActivity;
    if (inactiveTime > 30 * 60 * 1000) { // 30 minutes
      console.log(`App has been inactive for ${Math.round(inactiveTime/60000)} minutes, forcing reconnect`);
      needsReconnect = true;
    }
    
    // Check for stale high-priority subscriptions
    this.subscriptions.forEach((sub, key) => {
      if (sub.priority === 'high' && now - sub.lastActivity > 5 * 60 * 1000) { // 5 minutes
        console.log(`High priority subscription ${key} is stale, forcing reconnect`);
        needsReconnect = true;
      }
    });
    
    if (needsReconnect) {
      this.reestablishSubscriptions();
    }
  }
  
  // Setup visibility-based refetching
  setupVisibilityBasedRefetching() {
    let lastVisibleTime = Date.now();
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const invisibleTime = now - lastVisibleTime;
        
        // If the page was invisible for more than 2 minutes
        if (invisibleTime > 2 * 60 * 1000) {
          console.log(`Page was invisible for ${Math.round(invisibleTime/1000)} seconds, refreshing data`);
          
          // For critical data, invalidate immediately
          this.queryClient.invalidateQueries();
          
          // Also check subscription health
          this.checkConnectionHealth();
        }
        
        lastVisibleTime = now;
        this.lastGlobalActivity = now;
      } else {
        lastVisibleTime = Date.now();
      }
    });
  }
  
  // Setup network-based refetching
  setupNetworkStatusRefetching() {
    window.addEventListener('online', () => {
      console.log('Network reconnected, refreshing data');
      this.queryClient.invalidateQueries();
    });
  }
  
  // Subscribe to a table
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
    // Generate a unique subscription key
    const subscriptionKey = typeof queryKey === 'string' 
      ? `${table}::${queryKey}` 
      : `${table}::${JSON.stringify(queryKey)}`;
    
    // Return existing subscription if we have it
    if (this.subscriptions.has(subscriptionKey)) {
      return {
        unsubscribe: () => this.unsubscribeFromTable(subscriptionKey)
      };
    }
    
    console.log(`Creating subscription for ${table} with ${priority} priority`);
    
    // Create a unique channel name
    const channelName = `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Set up subscription config
    const config: any = {
      event: filter?.event || '*',
      schema: filter?.schema || 'public',
      table
    };
    
    if (filter?.filter) {
      config.filter = filter.filter;
    }
    
    // Create the channel
    const channel = supabase.channel(channelName);
    
    // Add the postgres_changes handler
    channel.on('postgres_changes', config, (payload) => {
      console.log(`Received ${payload.eventType} for ${table}:`, payload);
      
      // Update subscription activity timestamp
      const sub = this.subscriptions.get(subscriptionKey);
      if (sub) {
        sub.lastActivity = Date.now();
        sub.isConnected = true;
      }
      
      // Invalidate the corresponding query
      if (Array.isArray(queryKey)) {
        this.queryClient.invalidateQueries({ queryKey });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    });
    
    // Add the presence handler for activity tracking
    channel.on('presence', { event: 'sync' }, () => {
      // Update subscription activity timestamp
      const sub = this.subscriptions.get(subscriptionKey);
      if (sub) {
        sub.lastActivity = Date.now();
        sub.isConnected = true;
      }
    });
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log(`Subscription status for ${table}: ${status}`);
      
      // Update subscription status
      const sub = this.subscriptions.get(subscriptionKey);
      if (sub) {
        sub.isConnected = status === 'SUBSCRIBED';
        sub.lastActivity = Date.now();
      }
      
      // Update global connection status
      if (status === 'SUBSCRIBED') {
        this.connectionStatus = 'connected';
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Error in channel ${channelName}`);
        
        // Schedule a reconnect for this specific channel
        setTimeout(() => {
          this.reestablishSubscription(subscriptionKey);
        }, 5000);
      }
    });
    
    // Store the subscription
    this.subscriptions.set(subscriptionKey, {
      channel,
      queryKey,
      priority,
      lastActivity: Date.now(),
      isConnected: false
    });
    
    // Track table -> subscription mapping
    if (!this.tableSubscriptions.has(table)) {
      this.tableSubscriptions.set(table, new Set());
    }
    this.tableSubscriptions.get(table)?.add(subscriptionKey);
    
    // Return unsubscribe function
    return {
      unsubscribe: () => this.unsubscribeFromTable(subscriptionKey)
    };
  }
  
  // Subscribe to multiple tables at once
  subscribeToTables(
    tables: Array<{
      table: string;
      queryKey: string | string[];
      filter?: {
        event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
        schema?: string;
        filter?: string;
      };
      priority?: 'high' | 'medium' | 'low';
    }>
  ) {
    // Create all subscriptions
    const subscriptions = tables.map(({ table, queryKey, filter, priority }) => {
      return this.subscribeToTable(table, queryKey, filter, priority || 'medium');
    });
    
    // Return composite unsubscribe function
    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      }
    };
  }
  
  // Unsubscribe from a table
  private unsubscribeFromTable(subscriptionKey: string) {
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      // Extract table name from subscription key
      const table = subscriptionKey.split('::')[0];
      
      console.log(`Unsubscribing from ${subscriptionKey}`);
      
      // Remove from table subscriptions mapping
      this.tableSubscriptions.get(table)?.delete(subscriptionKey);
      if (this.tableSubscriptions.get(table)?.size === 0) {
        this.tableSubscriptions.delete(table);
      }
      
      // Remove the channel
      try {
        supabase.removeChannel(subscription.channel);
      } catch (e) {
        console.error(`Error removing channel for ${subscriptionKey}:`, e);
      }
      
      // Remove from subscriptions map
      this.subscriptions.delete(subscriptionKey);
    }
  }
  
  // Register a subscription with a route
  registerRouteSubscription(route: string, subscriptionKey: string) {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
  }
  
  // Clean up subscriptions for a route
  cleanupRouteDependentSubscriptions(route: string) {
    const subscriptions = this.routeSubscriptions.get(route);
    
    if (subscriptions) {
      console.log(`Cleaning up ${subscriptions.size} subscriptions for route ${route}`);
      
      // Create a copy of the set to avoid iteration issues
      const subscriptionsToClean = [...subscriptions];
      
      // Clean up each subscription
      subscriptionsToClean.forEach(subKey => {
        this.unsubscribeFromTable(subKey);
      });
      
      // Clear the route subscriptions
      this.routeSubscriptions.delete(route);
    }
  }
  
  // Force refresh subscriptions for specific tables
  forceRefreshSubscriptions(tables: string[]) {
    console.log(`Force refreshing subscriptions for: ${tables.join(', ')}`);
    
    // For each table, find all its subscriptions and reestablish them
    tables.forEach(table => {
      const subscriptions = this.tableSubscriptions.get(table);
      
      if (subscriptions) {
        [...subscriptions].forEach(subKey => {
          this.reestablishSubscription(subKey);
        });
      }
    });
    
    // Also invalidate the corresponding queries
    tables.forEach(table => {
      this.queryClient.invalidateQueries({ queryKey: [table] });
    });
  }
  
  // Reestablish all subscriptions
  reestablishSubscriptions() {
    console.log(`Reestablishing ${this.subscriptions.size} subscriptions`);
    
    // Create a copy of subscription keys to avoid iteration issues
    const subscriptionKeys = [...this.subscriptions.keys()];
    
    // Reestablish each subscription
    subscriptionKeys.forEach(subKey => {
      this.reestablishSubscription(subKey);
    });
  }
  
  // Reestablish a specific subscription
  reestablishSubscription(subscriptionKey: string) {
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      console.log(`Reestablishing subscription ${subscriptionKey}`);
      
      // Extract table name from subscription key
      const table = subscriptionKey.split('::')[0];
      
      // Remove the existing channel
      try {
        supabase.removeChannel(subscription.channel);
      } catch (e) {
        console.error(`Error removing channel for ${subscriptionKey}:`, e);
      }
      
      // Remove from maps
      this.subscriptions.delete(subscriptionKey);
      
      // Recreate the subscription
      this.subscribeToTable(table, subscription.queryKey, undefined, subscription.priority);
      
      // Invalidate the corresponding query
      if (Array.isArray(subscription.queryKey)) {
        this.queryClient.invalidateQueries({ queryKey: subscription.queryKey });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [subscription.queryKey] });
      }
    }
  }
  
  // Get subscription status
  getSubscriptionStatus(table: string, queryKey: string | string[]) {
    const subscriptionKey = typeof queryKey === 'string' 
      ? `${table}::${queryKey}` 
      : `${table}::${JSON.stringify(queryKey)}`;
    
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      return {
        isConnected: subscription.isConnected,
        lastActivity: subscription.lastActivity,
        priority: subscription.priority
      };
    }
    
    return {
      isConnected: false,
      lastActivity: 0,
      priority: 'low' as const
    };
  }
  
  // Get all subscriptions by table
  getSubscriptionsByTable() {
    const result: Record<string, string[]> = {};
    
    this.tableSubscriptions.forEach((subscriptions, table) => {
      result[table] = [...subscriptions];
    });
    
    return result;
  }
  
  // Get subscription count
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
  
  // Get active subscriptions
  getActiveSubscriptions() {
    return [...this.subscriptions.keys()];
  }
  
  // Get connection status
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    // If we have no subscriptions, return the global status
    if (this.subscriptions.size === 0) {
      return this.connectionStatus;
    }
    
    // Check high priority subscriptions first
    let anyHighPriorityConnected = false;
    let anyConnected = false;
    
    this.subscriptions.forEach(sub => {
      if (sub.isConnected) {
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
}
