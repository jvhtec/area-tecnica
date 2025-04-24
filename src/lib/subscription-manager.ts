import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel, RealtimeChannelOptions } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/api-config";

// Define interfaces for our subscription tracking
interface SubscriptionObject {
  unsubscribe: () => void;
  lastActivity?: number;
  status?: 'connected' | 'error' | 'disconnected';
  errorCount?: number;
}

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, SubscriptionObject> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'connecting'; // Start with connecting
  private pendingSubscriptions: Map<string, { table: string, queryKey: string | string[] }> = new Map();
  private lastReconnectAttempt: number = 0;
  private reconnectTimeoutId: number | null = null;
  private batchedInvalidations: Map<string, Set<string | string[]>> = new Map();
  private batchTimeout: number | null = null;
  private debounceTimeouts: Map<string, number> = new Map();
  private healthCheckInterval: number | null = null;
  private pingChannel: RealtimeChannel | null = null;
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupConnectionMonitoring();
    this.setupHealthCheck();
  }
  
  static getInstance(queryClient: QueryClient): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager(queryClient);
    }
    return SubscriptionManager.instance;
  }
  
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

  private setupPingChannel() {
    // Create a dedicated channel for connection monitoring
    try {
      if (this.pingChannel) {
        supabase.removeChannel(this.pingChannel);
      }

      const channelName = `ping-channel-${Date.now()}`;
      
      // Use the direct Supabase URL from config to ensure proper connection
      this.pingChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true }
        }
      });
      
      this.pingChannel.subscribe((status) => {
        console.log('Ping channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Successfully connected
          this.connectionStatus = 'connected';
          console.log('Supabase realtime connection established');
        } else if (status === 'CHANNEL_ERROR') {
          // Connection failed
          this.connectionStatus = 'disconnected';
          console.log('Supabase realtime connection failed');
          
          // Attempt reconnection after a delay
          setTimeout(() => this.setupPingChannel(), 5000);
        } else if (status === 'TIMED_OUT') {
          this.connectionStatus = 'disconnected';
          console.log('Supabase realtime connection timed out');
          
          // Attempt reconnection after a delay
          setTimeout(() => this.setupPingChannel(), 5000);
        }
      });
    } catch (error) {
      console.error('Error setting up ping channel:', error);
      this.connectionStatus = 'disconnected';
    }
  }
  
  private setupHealthCheck() {
    // Clear any existing interval
    if (this.healthCheckInterval !== null) {
      window.clearInterval(this.healthCheckInterval);
    }
    
    // Set up a health check interval (every 30 seconds)
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }
  
  private performHealthCheck() {
    console.log('Performing subscription health check');
    
    // Check if we need to verify the connection
    if (this.connectionStatus !== 'connected') {
      this.setupPingChannel();
    }
    
    // Check existing subscriptions
    const now = Date.now();
    let hasDeadSubscriptions = false;
    
    this.subscriptions.forEach((subscription, key) => {
      try {
        // Split the key into table and serialized query key parts
        const parts = key.split('::');
        const table = parts[0];
        const serializedKey = parts.length > 1 ? parts[1] : undefined;
        
        // Check if subscription is stale
        const lastActivity = subscription.lastActivity || 0;
        const isStale = now - lastActivity > 5 * 60 * 1000; // 5 minutes
        
        // If subscription is stale or has error status, mark for reconnection
        if (isStale || subscription.status === 'error' || subscription.status === 'disconnected') {
          console.log(`Detected stale or broken subscription for ${table}, will reconnect`);
          hasDeadSubscriptions = true;
          
          // Determine the query key
          let queryKey;
          if (serializedKey) {
            try {
              // Only attempt to parse if it looks like JSON
              if (serializedKey.startsWith('[') || serializedKey.startsWith('{')) {
                queryKey = JSON.parse(serializedKey);
              } else {
                // For simple strings, use as-is
                queryKey = serializedKey;
              }
            } catch (parseError) {
              console.warn(`Failed to parse query key "${serializedKey}" for table ${table}:`, parseError);
              queryKey = table; // Fallback to table name
            }
          } else {
            queryKey = table;
          }
          
          this.pendingSubscriptions.set(key, { table, queryKey });
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
  
  private handleOnline() {
    console.log('Network reconnected, reestablishing Supabase subscriptions');
    this.setupPingChannel();
    this.reestablishSubscriptions();
  }
  
  private handleOffline() {
    console.log('Network disconnected, subscriptions will reconnect when online');
    this.connectionStatus = 'disconnected';
  }
  
  private checkSubscriptionsHealth() {
    // When tab becomes visible, verify subscriptions are working
    console.log('Checking Supabase subscriptions health');
    
    // If we've been offline, attempt to reconnect
    if (this.connectionStatus === 'disconnected') {
      this.setupPingChannel();
      this.reestablishSubscriptions();
    }
  }
  
  private reestablishSubscriptions() {
    const now = Date.now();
    const RECONNECT_THROTTLE = 10000; // 10 seconds between reconnection attempts
    
    if (now - this.lastReconnectAttempt < RECONNECT_THROTTLE) {
      console.log('Throttling reconnection attempt');
      
      // Clear any existing reconnect timeout
      if (this.reconnectTimeoutId !== null) {
        window.clearTimeout(this.reconnectTimeoutId);
      }
      
      // Set a new reconnect timeout
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
      try {
        const parts = key.split('::');
        const table = parts[0];
        const serializedKey = parts.length > 1 ? parts[1] : undefined;
        
        let queryKey;
        if (serializedKey) {
          try {
            // Only attempt to parse if it looks like JSON
            if (serializedKey.startsWith('[') || serializedKey.startsWith('{')) {
              queryKey = JSON.parse(serializedKey);
            } else {
              queryKey = serializedKey;
            }
          } catch (error) {
            console.warn(`Error parsing serialized key during reestablishment: ${serializedKey}`);
            queryKey = table;
          }
        } else {
          queryKey = table;
        }
        
        this.pendingSubscriptions.set(key, { table, queryKey });
      } catch (error) {
        console.error(`Error processing subscription key ${key} during reestablishment:`, error);
      }
    });
    
    // Clear existing subscriptions
    this.unsubscribeAll();
    
    // Resubscribe to all tables
    this.pendingSubscriptions.forEach(({ table, queryKey }, key) => {
      this.subscribeToTable(table, queryKey);
      this.pendingSubscriptions.delete(key);
    });
    
    // Perform a full query invalidation to refresh data
    this.queryClient.invalidateQueries();
    
    this.connectionStatus = 'connected';
    console.log('Supabase subscriptions reestablished');
  }
  
  /**
   * Schedule a batched query invalidation to prevent UI thrashing
   * @param table The table that changed
   * @param queryKey The query key to invalidate
   */
  private scheduleBatchedInvalidation(table: string, queryKey: string | string[]) {
    if (!this.batchedInvalidations.has(table)) {
      this.batchedInvalidations.set(table, new Set());
    }
    
    // Add the query key to the batch
    if (Array.isArray(queryKey)) {
      queryKey.forEach(key => {
        this.batchedInvalidations.get(table)?.add(key);
      });
    } else {
      this.batchedInvalidations.get(table)?.add(queryKey);
    }
    
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
   * Debounce a query invalidation for rapid updates
   * @param key A unique key for this debounce operation
   * @param callback The function to call after debounce
   * @param delay The debounce delay in ms
   */
  private debounce(key: string, callback: () => void, delay: number = 300) {
    // Clear any existing timeout for this key
    if (this.debounceTimeouts.has(key)) {
      window.clearTimeout(this.debounceTimeouts.get(key));
    }
    
    // Set a new timeout
    const timeoutId = window.setTimeout(() => {
      callback();
      this.debounceTimeouts.delete(key);
    }, delay);
    
    this.debounceTimeouts.set(key, timeoutId);
  }
  
  private createChannel(table: string, queryKey: string | string[]): RealtimeChannel {
    // Generate a truly unique channel name with timestamp and random ID
    const channelId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const channelName = `${table}-changes-${channelId}`;
    
    try {
      // Ensure we're using the proper configuration when creating the channel
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true }
        }
      });
      
      // Create a serialized query key for lookups
      const serializedKey = typeof queryKey === 'string' ? 
        queryKey : JSON.stringify(queryKey);
      
      const handleChange = (payload: any) => {
        console.log(`Received ${payload.eventType} for ${table}:`, payload);
        
        const subscription = this.subscriptions.get(`${table}::${serializedKey}`);
        if (subscription) {
          // Update the subscription metadata 
          const updatedSubscription: SubscriptionObject = {
            ...subscription,
            lastActivity: Date.now(),
            status: 'connected',
            errorCount: 0
          };
          this.subscriptions.set(`${table}::${serializedKey}`, updatedSubscription);
        }
        
        // Use the debounced batched invalidation to prevent thrashing
        this.debounce(`invalidate-${table}`, () => {
          if (typeof queryKey === 'string') {
            this.queryClient.invalidateQueries({ queryKey: [queryKey] });
          } else {
            this.queryClient.invalidateQueries({ queryKey });
          }
        }, 150);
      };
      
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        handleChange
      ).subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
        console.log(`Subscription to ${table} status:`, status);
        
        const subscription = this.subscriptions.get(`${table}::${serializedKey}`);
        if (!subscription) return;
        
        if (status === 'SUBSCRIBED') {
          // Update the subscription with status metadata
          const updatedSubscription: SubscriptionObject = {
            ...subscription,
            status: 'connected',
            lastActivity: Date.now()
          };
          this.subscriptions.set(`${table}::${serializedKey}`, updatedSubscription);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error in subscription to ${table}`);
          // Update the subscription with error status and increment error count
          const errorCount = subscription.errorCount || 0;
          const updatedSubscription: SubscriptionObject = {
            ...subscription,
            status: 'error',
            errorCount: errorCount + 1
          };
          this.subscriptions.set(`${table}::${serializedKey}`, updatedSubscription);
        }
      });
      
      return channel;
    } catch (error) {
      console.error(`Error creating channel for ${table}:`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to changes on a specific table and invalidate the corresponding React Query cache
   * @param table The table name to subscribe to
   * @param queryKey The query key or array of keys to invalidate when the table changes
   * @param filter Optional filter conditions for the subscription
   * @returns An object with an unsubscribe method
   */
  subscribeToTable(
    table: string, 
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    }
  ) {
    // Create a unique key for this subscription
    let serializedKey: string;
    
    if (Array.isArray(queryKey)) {
      serializedKey = JSON.stringify(queryKey);
    } else if (typeof queryKey === 'object') {
      serializedKey = JSON.stringify(queryKey);
    } else {
      serializedKey = queryKey;
    }
    
    const subscriptionKey = `${table}::${serializedKey}`;
    
    // If we already have this subscription, don't duplicate it
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Subscription to ${table} for ${serializedKey} already exists`);
      
      // Update the lastActivity timestamp to keep it fresh
      const subscription = this.subscriptions.get(subscriptionKey);
      if (subscription) {
        const updatedSubscription: SubscriptionObject = {
          ...subscription,
          lastActivity: Date.now()
        };
        this.subscriptions.set(subscriptionKey, updatedSubscription);
      }
      
      return {
        unsubscribe: () => this.unsubscribeFromTable(table, queryKey)
      };
    }
    
    console.log(`Setting up subscription to ${table} for query key ${serializedKey}`);
    
    try {
      // Create the channel with a unique name
      const channel = this.createChannel(table, queryKey);
      
      // Store the subscription for later cleanup with metadata
      const subscriptionObject: SubscriptionObject = { 
        unsubscribe: () => {
          console.log(`Removing subscription to ${table} for ${serializedKey}`);
          supabase.removeChannel(channel);
        },
        status: 'connected',
        lastActivity: Date.now(),
        errorCount: 0
      };
      
      this.subscriptions.set(subscriptionKey, subscriptionObject);
      
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
   * Subscribe to multiple tables at once with deduplication
   * @param tables Array of table names and query keys
   * @returns An object with an unsubscribe method for all subscriptions
   */
  subscribeToTables(tables: Array<{ 
    table: string, 
    queryKey: string | string[],
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
      schema?: string,
      filter?: string
    }
  }>) {
    // Deduplication: check for duplicate subscriptions and only keep unique ones
    const uniqueTables = tables.filter((tableInfo, index) => {
      const serializedKey = Array.isArray(tableInfo.queryKey) 
        ? JSON.stringify(tableInfo.queryKey) 
        : tableInfo.queryKey;
      const subscriptionKey = `${tableInfo.table}::${serializedKey}`;
      
      // Check if we already have this subscription
      if (this.subscriptions.has(subscriptionKey)) {
        console.log(`Skipping duplicate subscription to ${tableInfo.table} for ${serializedKey}`);
        return false;
      }
      
      // Check if this table+key appears earlier in the array
      const earlierIndex = tables.findIndex((earlier, earlierIdx) => {
        if (earlierIdx >= index) return false;
        
        const earlierSerializedKey = Array.isArray(earlier.queryKey) 
          ? JSON.stringify(earlier.queryKey) 
          : earlier.queryKey;
        
        return tableInfo.table === earlier.table && serializedKey === earlierSerializedKey;
      });
      
      return earlierIndex === -1;
    });
    
    console.log(`Setting up ${uniqueTables.length} unique subscriptions out of ${tables.length} requested`);
    
    const unsubscribeFunctions: Array<() => void> = [];
    
    uniqueTables.forEach(({ table, queryKey, filter }) => {
      const { unsubscribe } = this.subscribeToTable(table, queryKey, filter);
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
   * @param table The table name to unsubscribe from
   * @param queryKey The query key used when subscribing
   */
  unsubscribeFromTable(table: string, queryKey: string | string[]) {
    const serializedKey = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
    const subscriptionKey = `${table}::${serializedKey}`;
    
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
      console.log(`Unsubscribed from ${table} for ${serializedKey}`);
    } else {
      console.warn(`No subscription found for ${table} with key ${serializedKey}`);
    }
  }
  
  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll() {
    console.log(`Unsubscribing from all ${this.subscriptions.size} subscriptions`);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
  }
  
  /**
   * Get the current connection status
   * @returns The current connection status
   */
  getConnectionStatus() {
    return this.connectionStatus;
  }
  
  /**
   * Get the number of active subscriptions
   * @returns The number of active subscriptions
   */
  getSubscriptionCount() {
    return this.subscriptions.size;
  }
  
  /**
   * Get a list of all active subscriptions
   * @returns Array of subscription keys
   */
  getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }
  
  /**
   * Get subscriptions grouped by table for better visibility
   * @returns Object with tables as keys and arrays of query keys as values
   */
  getSubscriptionsByTable() {
    const tables: Record<string, string[]> = {};
    
    this.subscriptions.forEach((_, key) => {
      const [table, serializedKey] = key.split('::');
      
      if (!tables[table]) {
        tables[table] = [];
      }
      
      if (serializedKey) {
        tables[table].push(serializedKey);
      }
    });
    
    return tables;
  }
  
  // Setup visibility-based refetching that works with the subscription manager
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
  
  setupNetworkStatusRefetching() {
    window.addEventListener('online', () => {
      // When coming back online, invalidate all queries to get fresh data
      this.queryClient.invalidateQueries();
    });
  }
}
