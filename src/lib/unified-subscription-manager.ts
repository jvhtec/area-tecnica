import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/enhanced-supabase-client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

type SubscriptionOptions = {
  table: string;
  queryKey: string | string[];
  filter?: {
    event?: "INSERT" | "UPDATE" | "DELETE" | "*";
    schema?: string;
    filter?: string;
  };
  priority?: "high" | "medium" | "low"; // Priority for cleanup decisions
};

type SubscriptionStatus = {
  isConnected: boolean;
  lastActivity: number;
  errorCount: number;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
};

type Subscription = {
  options: SubscriptionOptions;
  channel: RealtimeChannel;
  status: SubscriptionStatus;
  unsubscribe: () => void;
};

/**
 * Unified Subscription Manager for handling Supabase real-time subscriptions
 * with enhanced monitoring, intelligent batching, and automatic recovery
 */
export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionsByTable: Map<string, Set<string>> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'connecting';
  private lastReconnectAttempt: number = 0;
  private reconnectTimeoutId: number | null = null;
  private healthCheckInterval: number | null = null;
  private pingChannel: RealtimeChannel | null = null;
  private pendingSubscriptions: Map<string, SubscriptionOptions> = new Map();
  private routeSubscriptions: Map<string, Set<string>> = new Map();
  private batchedInvalidations: Map<string, Set<string | string[]>> = new Map();
  private batchTimeout: number | null = null;
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupConnectionMonitoring();
    this.setupHealthCheck();
    
    // Listen for reconnect events dispatched from connection recovery service
    window.addEventListener('supabase-reconnect', () => this.reestablishSubscriptions());
  }
  
  /**
   * Get the singleton instance of the subscription manager
   */
  static getInstance(queryClient: QueryClient): UnifiedSubscriptionManager {
    if (!UnifiedSubscriptionManager.instance) {
      UnifiedSubscriptionManager.instance = new UnifiedSubscriptionManager(queryClient);
    }
    return UnifiedSubscriptionManager.instance;
  }
  
  /**
   * Set up monitoring for connection status
   */
  private setupConnectionMonitoring() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Monitor tab visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkSubscriptionsHealth();
      }
    });
    
    // Set up initial ping channel to detect connection status
    this.setupPingChannel();
  }
  
  /**
   * Create a ping channel to monitor connection status
   */
  private setupPingChannel() {
    try {
      if (this.pingChannel) {
        supabase.removeChannel(this.pingChannel);
      }
      
      const channelName = `ping-channel-${Date.now()}`;
      this.pingChannel = supabase.channel(channelName);
      
      this.pingChannel.subscribe((status) => {
        console.log('Ping channel status:', status);
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
          console.log('Supabase realtime connection established');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectionStatus = 'disconnected';
          console.log('Supabase realtime connection issue');
          
          // Attempt reconnection after a delay
          setTimeout(() => this.setupPingChannel(), 5000);
        }
      });
    } catch (error) {
      console.error('Error setting up ping channel:', error);
      this.connectionStatus = 'disconnected';
    }
  }
  
  /**
   * Set up periodic health checks for subscriptions
   */
  private setupHealthCheck() {
    if (this.healthCheckInterval !== null) {
      window.clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }
  
  /**
   * Perform health check to verify subscriptions are working
   */
  private performHealthCheck() {
    console.log('Performing subscription health check');
    
    // Check if we need to verify the connection
    if (this.connectionStatus !== 'connected') {
      this.setupPingChannel();
    }
    
    // Check for dead subscriptions
    let hasDeadSubscriptions = false;
    
    this.subscriptions.forEach((subscription, key) => {
      try {
        const { options } = subscription;
        const { table } = options;
        
        // Check if channel exists in supabase
        const channelExists = supabase.getChannels().some(
          channel => channel.topic.includes(table) && channel === subscription.channel
        );
        
        if (!channelExists) {
          console.log(`Detected broken subscription for ${table}, will reconnect`);
          hasDeadSubscriptions = true;
          this.pendingSubscriptions.set(key, options);
        }
      } catch (error) {
        console.error(`Error checking subscription health for key ${key}:`, error);
      }
    });
    
    // If we found broken subscriptions, attempt to reconnect
    if (hasDeadSubscriptions) {
      this.reestablishSubscriptions();
    }
  }
  
  /**
   * Handle network coming back online
   */
  private handleOnline() {
    console.log('Network reconnected, reestablishing Supabase subscriptions');
    this.setupPingChannel();
    this.reestablishSubscriptions();
  }
  
  /**
   * Handle network going offline
   */
  private handleOffline() {
    console.log('Network disconnected, subscriptions will reconnect when online');
    this.connectionStatus = 'disconnected';
  }
  
  /**
   * Check health of subscriptions when tab becomes visible
   */
  private checkSubscriptionsHealth() {
    console.log('Checking Supabase subscriptions health');
    
    // If we've been offline, attempt to reconnect
    if (this.connectionStatus === 'disconnected') {
      this.setupPingChannel();
      this.reestablishSubscriptions();
    }
  }
  
  /**
   * Rebuild all subscriptions after a connection issue
   */
  private reestablishSubscriptions() {
    const now = Date.now();
    const RECONNECT_THROTTLE = 10000; // 10 seconds between attempts
    
    // Throttle reconnection attempts
    if (now - this.lastReconnectAttempt < RECONNECT_THROTTLE) {
      console.log('Throttling reconnection attempt');
      
      if (this.reconnectTimeoutId !== null) {
        window.clearTimeout(this.reconnectTimeoutId);
      }
      
      this.reconnectTimeoutId = window.setTimeout(() => {
        this.lastReconnectAttempt = Date.now();
        this.reestablishSubscriptions();
      }, RECONNECT_THROTTLE);
      
      return;
    }
    
    this.lastReconnectAttempt = now;
    this.connectionStatus = 'connecting';
    
    // Copy all existing subscriptions to pending
    this.subscriptions.forEach((subscription, key) => {
      this.pendingSubscriptions.set(key, subscription.options);
    });
    
    // Clean up existing subscriptions
    this.unsubscribeAll(false);
    
    // Resubscribe to all tables
    this.pendingSubscriptions.forEach((options, key) => {
      this.subscribeToTable(options.table, options.queryKey, options.filter);
      this.pendingSubscriptions.delete(key);
    });
    
    // Perform a full query invalidation to refresh data
    this.queryClient.invalidateQueries();
    
    this.connectionStatus = 'connected';
    console.log('Supabase subscriptions reestablished');
  }
  
  /**
   * Schedule a batched query invalidation to prevent UI thrashing
   */
  private scheduleBatchedInvalidation(table: string, queryKey: string | string[]) {
    if (!this.batchedInvalidations.has(table)) {
      this.batchedInvalidations.set(table, new Set());
    }
    
    // Add the query key to the batch
    const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
    keys.forEach(key => {
      this.batchedInvalidations.get(table)?.add(key);
    });
    
    // If we already have a batch timeout, don't set another one
    if (this.batchTimeout !== null) {
      return;
    }
    
    // Process batched invalidations after a short delay
    this.batchTimeout = window.setTimeout(() => {
      this.processBatchedInvalidations();
      this.batchTimeout = null;
    }, 50); // 50ms batch window
  }
  
  /**
   * Process all batched invalidations
   */
  private processBatchedInvalidations() {
    console.log('Processing batched query invalidations');
    
    // For each table with pending invalidations
    this.batchedInvalidations.forEach((queryKeys, table) => {
      console.log(`Invalidating ${queryKeys.size} query keys for table ${table}`);
      
      // Invalidate each unique query key
      queryKeys.forEach(key => {
        if (typeof key === 'string') {
          this.queryClient.invalidateQueries({ queryKey: [key] });
        } else {
          this.queryClient.invalidateQueries({ queryKey: key });
        }
      });
    });
    
    // Clear all batched invalidations
    this.batchedInvalidations.clear();
  }
  
  /**
   * Create a unique key for a subscription
   */
  private createSubscriptionKey(table: string, queryKey: string | string[]): string {
    const serializedKey = Array.isArray(queryKey) 
      ? JSON.stringify(queryKey) 
      : queryKey;
      
    return `${table}::${serializedKey}`;
  }
  
  /**
   * Track subscription for a current route
   */
  registerRouteSubscription(route: string, subscriptionKey: string): void {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
  }
  
  /**
   * Clean up subscriptions when route changes
   */
  cleanupRouteDependentSubscriptions(currentRoute: string): void {
    // Find all routes that aren't current
    const routesToCleanup = Array.from(this.routeSubscriptions.keys())
      .filter(route => route !== currentRoute);
      
    // Collect subscription keys to clean up
    const subscriptionsToCleanup: Set<string> = new Set();
    
    // Add all subscription keys from other routes
    routesToCleanup.forEach(route => {
      const subscriptionKeys = this.routeSubscriptions.get(route);
      if (subscriptionKeys) {
        subscriptionKeys.forEach(key => {
          // Only add to cleanup if not used by current route
          if (!this.routeSubscriptions.get(currentRoute)?.has(key)) {
            subscriptionsToCleanup.add(key);
          }
        });
      }
      
      // Clear the route's subscriptions
      this.routeSubscriptions.delete(route);
    });
    
    // Unsubscribe from cleaned up subscriptions
    subscriptionsToCleanup.forEach(key => {
      const subscription = this.subscriptions.get(key);
      if (subscription) {
        const { table, queryKey } = subscription.options;
        this.unsubscribeFromTable(table, queryKey);
      }
    });
  }
  
  /**
   * Subscribe to changes on a specific table
   */
  subscribeToTable(
    table: string, 
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    },
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): { unsubscribe: () => void } {
    const subscriptionKey = this.createSubscriptionKey(table, queryKey);
    
    // If we already have this subscription, don't duplicate it
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Subscription to ${table} for ${subscriptionKey} already exists`);
      
      // Update priority if it's higher than current
      const existingSubscription = this.subscriptions.get(subscriptionKey)!;
      const currentPriority = existingSubscription.options.priority || 'medium';
      
      if (this.getPriorityValue(priority) > this.getPriorityValue(currentPriority)) {
        existingSubscription.options.priority = priority;
      }
      
      return {
        unsubscribe: () => this.unsubscribeFromTable(table, queryKey)
      };
    }
    
    // Track subscriptions by table for batch operations
    if (!this.subscriptionsByTable.has(table)) {
      this.subscriptionsByTable.set(table, new Set());
    }
    this.subscriptionsByTable.get(table)?.add(subscriptionKey);
    
    console.log(`Setting up subscription to ${table} for query key ${subscriptionKey}`);
    
    // Create a channel with a unique name
    const channelName = `${table}-changes-${Date.now()}`;
    
    try {
      // Create the channel
      const channel = supabase.channel(channelName);
      
      // Set up the callback handler for real-time changes
      const handleChange = (payload: any) => {
        console.log(`Received ${payload.eventType} for ${table}:`, payload);
        
        // Use batched invalidation
        this.scheduleBatchedInvalidation(table, queryKey);
      };
      
      // Configure the channel
      const channelConfig = {
        event: filter?.event || '*',
        schema: filter?.schema || 'public',
        table: table
      };
      
      // Add filter if provided
      if (filter?.filter) {
        // @ts-ignore - The Supabase types are incorrect for v2.x
        channelConfig.filter = filter.filter;
      }
      
      // Subscribe to postgres changes
      // @ts-ignore - Need to ignore TS errors because the types don't match the actual API
      channel.on('postgres_changes', channelConfig, handleChange);
      
      // Initial subscription status
      const status: SubscriptionStatus = {
        isConnected: false,
        lastActivity: Date.now(),
        errorCount: 0,
        status: 'connecting'
      };
      
      // Subscribe to the channel
      channel.subscribe((status) => {
        console.log(`Subscription to ${table} status:`, status);
        
        // Update subscription status
        const subscription = this.subscriptions.get(subscriptionKey);
        if (subscription) {
          if (status === 'SUBSCRIBED') {
            subscription.status.isConnected = true;
            subscription.status.status = 'connected';
            subscription.status.lastActivity = Date.now();
            this.connectionStatus = 'connected';
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`Error in subscription to ${table}`);
            subscription.status.status = 'error';
            subscription.status.errorCount += 1;
            
            // Queue for reconnection after multiple errors
            if (subscription.status.errorCount > 3) {
              this.pendingSubscriptions.set(subscriptionKey, subscription.options);
            }
          }
        }
      });
      
      // Create subscription object
      const subscription: Subscription = {
        options: { table, queryKey, filter, priority },
        channel,
        status,
        unsubscribe: () => {
          console.log(`Removing subscription to ${table} for ${subscriptionKey}`);
          supabase.removeChannel(channel);
          
          // Remove from tracking maps
          this.subscriptions.delete(subscriptionKey);
          this.subscriptionsByTable.get(table)?.delete(subscriptionKey);
          if (this.subscriptionsByTable.get(table)?.size === 0) {
            this.subscriptionsByTable.delete(table);
          }
        }
      };
      
      // Store the subscription
      this.subscriptions.set(subscriptionKey, subscription);
      
      return {
        unsubscribe: () => this.unsubscribeFromTable(table, queryKey)
      };
    } catch (error) {
      console.error(`Error creating subscription to ${table}:`, error);
      return {
        unsubscribe: () => {} // Empty function for error case
      };
    }
  }
  
  /**
   * Get numerical value for priority comparison
   */
  private getPriorityValue(priority: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }
  
  /**
   * Subscribe to multiple tables at once with deduplication
   */
  subscribeToTables(tables: Array<{ 
    table: string, 
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    },
    priority?: 'high' | 'medium' | 'low'
  }>): { unsubscribe: () => void } {
    // Deduplication logic
    const uniqueTables = tables.filter((tableInfo, index) => {
      const subscriptionKey = this.createSubscriptionKey(
        tableInfo.table, 
        tableInfo.queryKey
      );
      
      // Check if we already have this subscription
      if (this.subscriptions.has(subscriptionKey)) {
        // Update priority if needed
        const existingSubscription = this.subscriptions.get(subscriptionKey)!;
        const currentPriority = existingSubscription.options.priority || 'medium';
        const newPriority = tableInfo.priority || 'medium';
        
        if (this.getPriorityValue(newPriority) > this.getPriorityValue(currentPriority)) {
          existingSubscription.options.priority = newPriority;
        }
        
        return false;
      }
      
      // Check if this table+key appears earlier in the array
      const earlierIndex = tables.findIndex((earlier, earlierIdx) => {
        if (earlierIdx >= index) return false;
        
        const earlierKey = this.createSubscriptionKey(
          earlier.table, 
          earlier.queryKey
        );
        
        return subscriptionKey === earlierKey;
      });
      
      return earlierIndex === -1;
    });
    
    console.log(`Setting up ${uniqueTables.length} unique subscriptions out of ${tables.length} requested`);
    
    const unsubscribeFunctions: Array<() => void> = [];
    
    uniqueTables.forEach(({ table, queryKey, filter, priority }) => {
      const { unsubscribe } = this.subscribeToTable(table, queryKey, filter, priority);
      unsubscribeFunctions.push(unsubscribe);
    });
    
    return {
      unsubscribe: () => {
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
      }
    };
  }
  
  /**
   * Unsubscribe from a specific table
   */
  unsubscribeFromTable(table: string, queryKey: string | string[]) {
    const subscriptionKey = this.createSubscriptionKey(table, queryKey);
    
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
    } else {
      console.warn(`No subscription found for ${table} with key ${subscriptionKey}`);
    }
  }
  
  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll(clearRoutes: boolean = true) {
    console.log(`Unsubscribing from all ${this.subscriptions.size} subscriptions`);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
    this.subscriptionsByTable.clear();
    
    if (clearRoutes) {
      this.routeSubscriptions.clear();
    }
  }
  
  /**
   * Get the current connection status
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStatus;
  }
  
  /**
   * Get the number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
  
  /**
   * Get a list of all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
  
  /**
   * Get subscriptions grouped by table for better visibility
   */
  getSubscriptionsByTable(): Record<string, string[]> {
    const tables: Record<string, string[]> = {};
    
    this.subscriptionsByTable.forEach((subscriptionKeys, table) => {
      tables[table] = Array.from(subscriptionKeys);
    });
    
    return tables;
  }
  
  /**
   * Get detailed status for a specific subscription
   */
  getSubscriptionStatus(table: string, queryKey: string | string[]): SubscriptionStatus {
    const subscriptionKey = this.createSubscriptionKey(table, queryKey);
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      return subscription.status;
    }
    
    return {
      isConnected: false,
      lastActivity: 0,
      errorCount: 0,
      status: 'disconnected'
    };
  }
  
  /**
   * Setup visibility-based refetching
   */
  setupVisibilityBasedRefetching() {
    let lastRefetchTime = Date.now();
    const THROTTLE_TIME = 10000; // 10 seconds minimum between refetches
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastRefetchTime > THROTTLE_TIME) {
          // Only refetch when sufficient time has passed since last refetch
          this.queryClient.invalidateQueries();
          lastRefetchTime = now;
        }
      }
    });
  }
  
  /**
   * Setup network status refetching
   */
  setupNetworkStatusRefetching() {
    window.addEventListener('online', () => {
      // When coming back online, invalidate all queries to get fresh data
      this.queryClient.invalidateQueries();
    });
  }
}
