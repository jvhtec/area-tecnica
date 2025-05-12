import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, { unsubscribe: () => void, options: any }>;
  private pendingSubscriptions: Map<string, any>;
  private routeSubscriptions: Map<string, Set<string>>;
  private lastReconnectAttempt: number;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting';
  private pingChannelId: string | null;
  private connectionAttempts: number = 0;
  private subscriptionActivity: Map<string, number>;
  private networkStatusHandler: () => void;
  private visibilityChangeHandler: () => void;

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.subscriptions = new Map();
    this.pendingSubscriptions = new Map();
    this.routeSubscriptions = new Map();
    this.subscriptionActivity = new Map();
    this.lastReconnectAttempt = 0;
    this.connectionStatus = 'connecting';
    this.pingChannelId = null;
    
    // Initialize connection
    this.setupPingChannel();
  }

  // Singleton pattern implementation
  public static getInstance(queryClient: QueryClient): UnifiedSubscriptionManager {
    if (!UnifiedSubscriptionManager.instance) {
      UnifiedSubscriptionManager.instance = new UnifiedSubscriptionManager(queryClient);
    }
    return UnifiedSubscriptionManager.instance;
  }
  
  // Setup a ping channel to monitor connection status
  private setupPingChannel() {
    try {
      // Generate a unique channel ID
      const channelId = `heartbeat-${Date.now()}`;
      this.pingChannelId = channelId;
      
      console.log(`Setting up ping channel: ${channelId}`);
      this.connectionStatus = 'connecting';
      
      // Create a ping channel
      const channel = supabase.channel(channelId, {
        config: {
          broadcast: { self: true }
        }
      });
      
      // Track connection status
      channel
        .on('presence', { event: 'sync' }, () => {
          console.log('Ping channel synced - connection is healthy');
          this.connectionStatus = 'connected';
          this.connectionAttempts = 0;
        })
        .on('presence', { event: 'join' }, () => {
          console.log('Ping channel joined - connection established');
          this.connectionStatus = 'connected';
        })
        .on('presence', { event: 'leave' }, () => {
          console.log('Ping channel left - connection may be interrupted');
        })
        .on('system', { event: 'disconnect' }, () => {
          console.log('Ping channel disconnected');
          this.connectionStatus = 'disconnected';
          this.attemptReconnection();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public'
        }, () => {
          // This is just a test to ensure the connection is working
          console.log('Received postgres change - connection is healthy');
          this.connectionStatus = 'connected';
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            console.log('Ping channel subscribed - connection is healthy');
            this.connectionStatus = 'connected';
            
            // Set presence data for ping
            channel.track({
              online_at: new Date().toISOString(),
              client_id: channelId
            });
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Ping channel error - connection may be interrupted');
            this.connectionStatus = 'disconnected';
            this.attemptReconnection();
          } else if (status === 'TIMED_OUT') {
            console.error('Ping channel timed out - connection may be interrupted');
            this.connectionStatus = 'disconnected';
            this.attemptReconnection();
          }
        });
      
      return channel;
    } catch (error) {
      console.error('Error setting up ping channel:', error);
      this.connectionStatus = 'disconnected';
      return null;
    }
  }
  
  // Attempt to reconnect with exponential backoff
  private attemptReconnection() {
    const now = Date.now();
    
    // Avoid too frequent reconnection attempts
    if (now - this.lastReconnectAttempt < 5000) {
      console.log('Avoiding reconnection attempt - too recent');
      return;
    }
    
    this.lastReconnectAttempt = now;
    this.connectionAttempts++;
    
    const backoffTime = Math.min(1000 * Math.pow(2, this.connectionAttempts - 1), 30000);
    console.log(`Will attempt reconnection in ${backoffTime}ms (attempt #${this.connectionAttempts})`);
    
    setTimeout(() => {
      console.log(`Attempting reconnection (#${this.connectionAttempts})`);
      this.reestablishSubscriptions();
    }, backoffTime);
  }

  // Function to expose the reestablishSubscriptions method
  public reestablishSubscriptions() {
    console.log('Manually reestablishing subscriptions');
    this.setupPingChannel();
    
    const now = Date.now();
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
      this.subscribeToTable(options.table, options.queryKey, options.filter, options.priority);
      this.pendingSubscriptions.delete(key);
    });
    
    // Perform a full query invalidation to refresh data
    this.queryClient.invalidateQueries();
    
    this.connectionStatus = 'connected';
    console.log('Supabase subscriptions manually reestablished');
    
    return true;
  }

  // Clean up subscriptions for a specific route
  public cleanupRouteDependentSubscriptions(route: string) {
    console.log(`Cleaning up subscriptions for route: ${route}`);
    
    // Get the set of subscription keys associated with this route
    const subscriptionKeys = this.routeSubscriptions.get(route);
    
    if (!subscriptionKeys || subscriptionKeys.size === 0) {
      console.log(`No subscriptions found for route ${route}`);
      return;
    }
    
    // Check each subscription to see if it's used by other routes before unsubscribing
    subscriptionKeys.forEach(key => {
      let isUsedElsewhere = false;
      
      // Check if this subscription is used by any other route
      this.routeSubscriptions.forEach((keys, otherRoute) => {
        if (otherRoute !== route && keys.has(key)) {
          isUsedElsewhere = true;
        }
      });
      
      // If not used elsewhere, unsubscribe
      if (!isUsedElsewhere) {
        console.log(`Unsubscribing from ${key} as it's no longer needed`);
        const subscription = this.subscriptions.get(key);
        if (subscription) {
          subscription.unsubscribe();
          this.subscriptions.delete(key);
        }
      } else {
        console.log(`Keeping subscription to ${key} as it's used by other routes`);
      }
    });
    
    // Clear the route's subscription list
    this.routeSubscriptions.delete(route);
  }

  // Subscribe to a specific table with custom options
  public subscribeToTable(
    table: string, 
    queryKey: string | string[], 
    filter?: any, 
    priority: 'high' | 'medium' | 'low' = 'medium'
  ) {
    try {
      // Create a subscription key
      const subscriptionKeyStr = Array.isArray(queryKey) 
        ? `${table}::${JSON.stringify(queryKey)}`
        : `${table}::${queryKey}`;
      
      // Check if we already have this subscription
      if (this.subscriptions.has(subscriptionKeyStr)) {
        console.log(`Already subscribed to ${subscriptionKeyStr}, updating activity timestamp`);
        this.subscriptionActivity.set(subscriptionKeyStr, Date.now());
        return this.subscriptions.get(subscriptionKeyStr);
      }
      
      console.log(`Subscribing to table ${table} with key ${subscriptionKeyStr}`);
      
      // Prepare filter for Supabase
      const eventFilter = filter?.event || '*';
      const schemaFilter = filter?.schema || 'public';
      const columnFilter = filter?.filter ? { filter: filter.filter } : undefined;
      
      // Create channel for this subscription
      const channelKey = `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const channel = supabase.channel(channelKey);
      
      // Setup Postgres changes listener
      channel.on(
        'postgres_changes',
        {
          event: eventFilter,
          schema: schemaFilter,
          table: table,
          ...columnFilter
        },
        (payload) => {
          console.log(`Received change on ${table}:`, payload);
          
          // Update activity timestamp
          this.subscriptionActivity.set(subscriptionKeyStr, Date.now());
          
          // Invalidate related queries
          if (Array.isArray(queryKey)) {
            this.queryClient.invalidateQueries({ queryKey });
          } else {
            this.queryClient.invalidateQueries({ queryKey: [queryKey] });
          }
        }
      ).subscribe(status => {
        if (status === 'SUBSCRIBED') {
          console.log(`Successfully subscribed to ${table}`);
          this.connectionStatus = 'connected';
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error subscribing to ${table}`);
          this.connectionStatus = 'disconnected';
          this.attemptReconnection();
        }
      });
      
      // Create unsubscribe function
      const unsubscribe = () => {
        try {
          supabase.removeChannel(channel);
          this.subscriptions.delete(subscriptionKeyStr);
          this.subscriptionActivity.delete(subscriptionKeyStr);
          console.log(`Unsubscribed from ${subscriptionKeyStr}`);
        } catch (error) {
          console.error(`Error unsubscribing from ${subscriptionKeyStr}:`, error);
        }
      };
      
      // Store subscription with its options
      const subscription = { unsubscribe, options: { table, queryKey, filter, priority } };
      this.subscriptions.set(subscriptionKeyStr, subscription);
      
      // Set initial activity timestamp
      this.subscriptionActivity.set(subscriptionKeyStr, Date.now());
      
      return subscription;
    } catch (error) {
      console.error(`Error subscribing to table ${table}:`, error);
      return { unsubscribe: () => {} };
    }
  }

  // Register a subscription with a specific route
  public registerRouteSubscription(route: string, subscriptionKey: string) {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
    console.log(`Registered subscription ${subscriptionKey} with route ${route}`);
  }

  // Subscribe to multiple tables at once
  public subscribeToTables(tableConfigs: Array<{
    table: string, 
    queryKey: string | string[],
    filter?: any,
    priority?: 'high' | 'medium' | 'low'
  }>) {
    const subscriptions: { unsubscribe: () => void }[] = [];
    
    tableConfigs.forEach(config => {
      const subscription = this.subscribeToTable(
        config.table, 
        config.queryKey, 
        config.filter, 
        config.priority || 'medium'
      );
      
      subscriptions.push(subscription);
    });
    
    // Return a combined unsubscribe function
    return {
      unsubscribe: () => {
        subscriptions.forEach(subscription => subscription.unsubscribe());
      }
    };
  }

  // Unsubscribe from all subscriptions
  public unsubscribeAll(clearPending: boolean = true) {
    console.log('Unsubscribing from all subscriptions');
    
    try {
      this.subscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      
      this.subscriptions.clear();
      this.subscriptionActivity.clear();
      
      if (clearPending) {
        this.pendingSubscriptions.clear();
      }
      
      console.log('Successfully unsubscribed from all subscriptions');
    } catch (error) {
      console.error('Error unsubscribing from all subscriptions:', error);
    }
  }

  // Set up visibility-based query refetching
  public setupVisibilityBasedRefetching() {
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, checking subscription health');
        
        const now = Date.now();
        const staleTime = 5 * 60 * 1000; // 5 minutes
        let hasStaleSubscriptions = false;
        
        // Check for stale subscriptions
        this.subscriptionActivity.forEach((lastActivity, key) => {
          if (now - lastActivity > staleTime) {
            console.log(`Subscription ${key} is stale, last activity: ${new Date(lastActivity).toISOString()}`);
            hasStaleSubscriptions = true;
          }
        });
        
        // If we have stale subscriptions, reestablish connections
        if (hasStaleSubscriptions || this.connectionStatus !== 'connected') {
          console.log('Reestablishing subscriptions due to stale status or visibility change');
          this.reestablishSubscriptions();
        } else {
          console.log('All subscriptions appear to be healthy');
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    console.log('Visibility-based refetching set up');
  }

  // Set up network status-based query refetching
  public setupNetworkStatusRefetching() {
    this.networkStatusHandler = () => {
      if (navigator.onLine) {
        console.log('Network connection restored, reestablishing subscriptions');
        this.reestablishSubscriptions();
      } else {
        console.log('Network connection lost');
        this.connectionStatus = 'disconnected';
      }
    };
    
    window.addEventListener('online', this.networkStatusHandler);
    window.addEventListener('offline', this.networkStatusHandler);
    console.log('Network status-based refetching set up');
  }

  // Get subscriptions by table
  public getSubscriptionsByTable() {
    const subscriptionsByTable: Record<string, string[]> = {};
    
    this.subscriptions.forEach((subscription, key) => {
      const table = subscription.options.table;
      
      if (!subscriptionsByTable[table]) {
        subscriptionsByTable[table] = [];
      }
      
      subscriptionsByTable[table].push(key);
    });
    
    return subscriptionsByTable;
  }

  // Get active subscriptions
  public getActiveSubscriptions() {
    return Array.from(this.subscriptions.keys());
  }

  // Get subscription count
  public getSubscriptionCount() {
    return this.subscriptions.size;
  }

  // Get connection status
  public getConnectionStatus() {
    return this.connectionStatus;
  }

  // Get subscription status
  public getSubscriptionStatus(table: string, queryKey: string | string[]) {
    const key = Array.isArray(queryKey) 
      ? `${table}::${JSON.stringify(queryKey)}`
      : `${table}::${queryKey}`;
    
    const isConnected = this.subscriptions.has(key);
    const lastActivity = this.subscriptionActivity.get(key) || 0;
    
    return { isConnected, lastActivity };
  }

  // Force refresh subscriptions for specific tables
  public forceRefreshSubscriptions(tables: string[]) {
    console.log(`Forcing refresh of subscriptions for tables: ${tables.join(', ')}`);
    
    // First gather all subscriptions related to these tables
    const subscriptionsToRefresh = new Map<string, any>();
    
    this.subscriptions.forEach((subscription, key) => {
      if (tables.includes(subscription.options.table)) {
        subscriptionsToRefresh.set(key, subscription.options);
      }
    });
    
    // Now unsubscribe from these tables
    subscriptionsToRefresh.forEach((options, key) => {
      const subscription = this.subscriptions.get(key);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(key);
      }
    });
    
    // Resubscribe to all tables
    subscriptionsToRefresh.forEach((options, key) => {
      this.subscribeToTable(options.table, options.queryKey, options.filter, options.priority);
    });
    
    // Invalidate related queries
    tables.forEach(table => {
      this.queryClient.invalidateQueries({ queryKey: [table] });
    });
    
    return true;
  }
  
  // Cleanup resources when needed
  public cleanup() {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    
    if (this.networkStatusHandler) {
      window.removeEventListener('online', this.networkStatusHandler);
      window.removeEventListener('offline', this.networkStatusHandler);
    }
    
    this.unsubscribeAll();
  }
}
