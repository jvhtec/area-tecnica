import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type SubscriptionSnapshot = {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  lastRefreshTime: number;
};

export type RealtimeSubscriptionFilter = {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
};

type SubscriptionPriority = 'high' | 'medium' | 'low';

type SubscriptionOptions = {
  table: string;
  queryKey: string | string[];
  filter?: RealtimeSubscriptionFilter;
  priority: SubscriptionPriority;
};

type ManagedSubscription = {
  key: string;
  unsubscribe: () => void;
  options: SubscriptionOptions;
};

/**
 * Enhanced subscription manager that centralizes all Supabase realtime subscriptions
 * and coordinates them with React Query cache invalidation
 */
export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, ManagedSubscription>;
  private pendingSubscriptions: Map<string, any>;
  private routeSubscriptions: Map<string, Set<string>>;
  private lastReconnectAttempt: number;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting';
  private pingChannel: any | null;
  private tableLastActivity: Map<string, number>;
  private visibilityChangeHandler?: () => void;
  private networkStatusHandler?: () => void;
  private invalidationTimers: Map<string, number>;
  private listeners: Set<() => void>;
  private snapshot: SubscriptionSnapshot;

  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.subscriptions = new Map();
    this.pendingSubscriptions = new Map();
    this.routeSubscriptions = new Map();
    this.tableLastActivity = new Map();
    this.lastReconnectAttempt = 0;
    this.connectionStatus = 'connecting';
    this.pingChannel = null;
    this.invalidationTimers = new Map();
    this.listeners = new Set();
    this.snapshot = {
      connectionStatus: 'connecting',
      activeSubscriptions: [],
      subscriptionCount: 0,
      subscriptionsByTable: {},
      lastRefreshTime: Date.now(),
    };
    
    // Initialize connection
    this.setupPingChannel();

    // Setup event to notify components when connections recover
    window.addEventListener('supabase-reconnect', () => this.reestablishSubscriptions());
  }

  /**
   * Singleton pattern implementation
   */
  public static getInstance(queryClient: QueryClient): UnifiedSubscriptionManager {
    if (!UnifiedSubscriptionManager.instance) {
      UnifiedSubscriptionManager.instance = new UnifiedSubscriptionManager(queryClient);
    }
    return UnifiedSubscriptionManager.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): SubscriptionSnapshot {
    return this.snapshot;
  }

  public markRefreshed() {
    this.updateSnapshot({ lastRefreshTime: Date.now() });
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn('[UnifiedSubscriptionManager] subscriber threw', error);
      }
    });
  }

  private normalizeQueryKey(queryKey: string | string[]) {
    return Array.isArray(queryKey) ? queryKey : [queryKey];
  }

  private getSubscriptionKey(table: string, queryKey: string | string[], filter?: RealtimeSubscriptionFilter) {
    const normalizedQueryKey = this.normalizeQueryKey(queryKey);
    const normalizedFilter = {
      event: filter?.event ?? '*',
      schema: filter?.schema ?? 'public',
      filter: filter?.filter ?? '',
    };

    return `${table}::${JSON.stringify(normalizedQueryKey)}::${normalizedFilter.event}::${normalizedFilter.schema}::${normalizedFilter.filter}`;
  }
  
  private updateSnapshot(partial: Partial<SubscriptionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.notify();
  }

  private refreshSnapshotFromState() {
    this.snapshot = {
      ...this.snapshot,
      connectionStatus: this.connectionStatus,
      activeSubscriptions: this.getActiveSubscriptions(),
      subscriptionCount: this.getSubscriptionCount(),
      subscriptionsByTable: this.getSubscriptionsByTable(),
    };
    this.notify();
  }
  
  /**
   * Setup a ping channel to monitor connection status
   */
  private setupPingChannel() {
    if (this.pingChannel) {
      try {
        supabase.removeChannel(this.pingChannel);
      } catch (error) {
        console.warn('[UnifiedSubscriptionManager] Failed removing ping channel', error);
      }
      this.pingChannel = null;
    }

    try {
      const pingChannel = supabase.channel('ping');
      this.pingChannel = pingChannel;
      
      pingChannel
        .on('presence', { event: 'sync' }, () => {
          this.connectionStatus = 'connected';
          console.log('Ping channel sync event - connection active');
          this.updateSnapshot({ connectionStatus: 'connected' });
        })
        .on('system', { event: 'disconnect' }, () => {
          this.connectionStatus = 'disconnected';
          console.log('Ping channel disconnect event - connection lost');
          this.updateSnapshot({ connectionStatus: 'disconnected' });
        })
        .on('system', { event: 'reconnected' }, () => {
          this.connectionStatus = 'connected';
          console.log('Ping channel reconnected - connection restored');
          this.updateSnapshot({ connectionStatus: 'connected' });
          this.reestablishSubscriptions();
        })
        .subscribe((status) => {
          console.log(`Ping channel status: ${status}`);
          if (status === 'SUBSCRIBED') {
            this.connectionStatus = 'connected';
            this.updateSnapshot({ connectionStatus: 'connected' });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            this.connectionStatus = 'disconnected';
            this.updateSnapshot({ connectionStatus: 'disconnected' });
          } else {
            this.connectionStatus = 'connecting';
            this.updateSnapshot({ connectionStatus: 'connecting' });
          }
        });
    } catch (error) {
      console.error('Error setting up ping channel:', error);
      this.connectionStatus = 'disconnected';
      this.updateSnapshot({ connectionStatus: 'disconnected' });
    }
  }

  private scheduleInvalidation(queryKey: string | string[], priority: 'high' | 'medium' | 'low') {
    const normalizedQueryKey = this.normalizeQueryKey(queryKey);
    const key = JSON.stringify(normalizedQueryKey);

    const existing = this.invalidationTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = priority === 'high' ? 50 : priority === 'medium' ? 200 : 500;
    const timeout = window.setTimeout(() => {
      try {
        this.queryClient.invalidateQueries({ queryKey: normalizedQueryKey });
      } finally {
        this.invalidationTimers.delete(key);
      }
    }, delay);

    this.invalidationTimers.set(key, timeout);
  }

  private invalidateStaleQueries(maxAgeMs: number) {
    const now = Date.now();
    const queryKeysToInvalidate = new Set<string>();

    this.subscriptions.forEach((subscription, subscriptionKey) => {
      const lastActivity = this.tableLastActivity.get(subscriptionKey) ?? 0;
      if (!lastActivity) return;
      if (now - lastActivity <= maxAgeMs) return;

      const normalized = this.normalizeQueryKey(subscription.options.queryKey);
      queryKeysToInvalidate.add(JSON.stringify(normalized));
    });

    if (!queryKeysToInvalidate.size) {
      return;
    }

    queryKeysToInvalidate.forEach((serialized) => {
      try {
        const parsed = JSON.parse(serialized) as string[];
        this.queryClient.invalidateQueries({ queryKey: parsed });
      } catch (error) {
        console.warn('[UnifiedSubscriptionManager] Failed to invalidate stale queryKey', error);
      }
    });

    this.updateSnapshot({ lastRefreshTime: Date.now() });
  }

  /**
   * Reestablish all subscriptions, typically after a connection loss
   */
  public reestablishSubscriptions(): boolean {
    console.log('Manually reestablishing subscriptions');
    this.setupPingChannel();
    
    const now = Date.now();
    // Don't attempt reconnection too frequently
    if (now - this.lastReconnectAttempt < 5000) {
      console.log('Reconnection attempt too soon, skipping');
      return false;
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
      this.subscribeToTable(options.table, options.queryKey, options.filter, options.priority);
      this.pendingSubscriptions.delete(key);
    });
    
    // Invalidate only queries that were idle for a while to prevent load spikes
    this.invalidateStaleQueries(5 * 60 * 1000);
    
    this.connectionStatus = 'connected';
    this.updateSnapshot({
      connectionStatus: 'connected',
      lastRefreshTime: Date.now(),
    });
    console.log('Supabase subscriptions reestablished');
    
    return true;
  }

  /**
   * Cleanup subscriptions when leaving a route
   */
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

  /**
   * Subscribe to a single table with intelligent cache invalidation
   */
  public subscribeToTable(
    table: string, 
    queryKey: string | string[], 
    filter?: RealtimeSubscriptionFilter,
    priority: SubscriptionPriority = 'medium'
  ) {
    const subscriptionKey = this.getSubscriptionKey(table, queryKey, filter);
    
    // Check if we already have this subscription (deduplication)
    if (this.subscriptions.has(subscriptionKey)) {
      if (priority === 'high') {
        console.log(`Already subscribed to ${table} with query key ${subscriptionKey}`);
      }
      return this.subscriptions.get(subscriptionKey);
    }
    
    if (priority === 'high') {
      console.log(`Subscribing to ${table} (priority: ${priority})`);
    }
    
    try {
      // Configure the subscription
      const eventType = filter?.event || '*';
      const schema = filter?.schema || 'public';
      const eventFilter = filter?.filter || undefined;
      
      // Create a unique channel name based on the subscription
      const channelName = `${table}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase.channel(channelName);
      
      // Configure channel with the subscription options
      const subscriptionConfig: any = {
        event: eventType,
        schema: schema,
        table: table
      };
      
      if (eventFilter) {
        subscriptionConfig.filter = eventFilter;
      }
      
      const channelSubscription = channel
        .on('postgres_changes', subscriptionConfig, (payload) => {
          // Reduced logging for performance
          if (priority === 'high') {
            console.log(`Received ${payload.eventType} for ${table}:`, payload);
          }
          
          // Update last activity timestamp
          this.tableLastActivity.set(subscriptionKey, Date.now());
          
          // Invalidate React Query cache based on the query key
          this.scheduleInvalidation(queryKey, priority);
        })
        .subscribe((status) => {
          console.log(`Channel ${channelName} status:`, status);
          
          // If channel subscription fails, retry with backoff
          if (status === 'CHANNEL_ERROR') {
            // Suppress noisy errors for job_departments which can be transient
            if (table !== 'job_departments') {
              console.error(`Error subscribing to ${table}, will retry...`);
            } else {
              console.warn(`Transient subscription error for ${table}, retrying silently...`);
            }
            setTimeout(() => {
              if (this.subscriptions.has(subscriptionKey)) {
                console.log(`Retrying subscription to ${table}`);
                const sub = this.subscriptions.get(subscriptionKey);
                if (sub) {
                  try {
                    sub.unsubscribe();
                  } catch (e) {
                    console.error('Error unsubscribing during retry:', e);
                  }
                  this.subscriptions.delete(subscriptionKey);
                }
                this.subscribeToTable(table, queryKey, filter, priority);
              }
            }, 5000); // Try again in 5 seconds
          }
        });
      
      // Create an object with unsubscribe function
      const subscription: ManagedSubscription = {
        key: subscriptionKey,
        unsubscribe: () => {
          console.log(`Unsubscribing from ${subscriptionKey}`);
          try {
            supabase.removeChannel(channel);
          } catch (error) {
            console.error(`Error removing channel for ${table}:`, error);
          }

          this.subscriptions.delete(subscriptionKey);
          this.tableLastActivity.delete(subscriptionKey);
          this.refreshSnapshotFromState();
        },
        options: { table, queryKey, filter, priority }
      };
      
      // Store the subscription for later cleanup
      this.subscriptions.set(subscriptionKey, subscription);
      
      // Initialize last activity timestamp
      this.tableLastActivity.set(subscriptionKey, Date.now());

      this.refreshSnapshotFromState();
      
      return subscription;
    } catch (error) {
      console.error(`Error subscribing to ${table}:`, error);
      return { key: subscriptionKey, unsubscribe: () => {}, options: { table, queryKey, filter, priority } };
    }
  }

  /**
   * Register a subscription with a specific route
   */
  public registerRouteSubscription(route: string, subscriptionKey: string) {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
  }

  /**
   * Subscribe to multiple tables at once
   */
  public subscribeToTables(
    tableConfigs: Array<{
      table: string, 
      queryKey: string | string[],
      filter?: RealtimeSubscriptionFilter,
      priority?: SubscriptionPriority
    }>
  ) {
    const subscriptions = tableConfigs.map(config => 
      this.subscribeToTable(
        config.table, 
        config.queryKey, 
        config.filter, 
        config.priority || 'medium'
      )
    );
    
    // Return a composite unsubscribe function
    return {
      unsubscribe: () => {
        subscriptions.forEach(subscription => subscription.unsubscribe());
      }
    };
  }

  /**
   * Unsubscribe from all subscriptions
   */
  public unsubscribeAll(clearPending: boolean = true) {
    console.log('Unsubscribing from all subscriptions');
    this.subscriptions.forEach((subscription, key) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.error(`Error unsubscribing from ${key}:`, error);
      }
    });
    
    this.subscriptions.clear();
    this.tableLastActivity.clear();
    this.refreshSnapshotFromState();
    
    if (clearPending) {
      this.pendingSubscriptions.clear();
    }
  }

  /**
   * Setup automatic refetching when window visibility changes
   */
  public setupVisibilityBasedRefetching() {
    // Clean up existing handler if it exists
    this.teardownVisibilityBasedRefetching();
    
    // Create new handler
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking for stale data...');
        this.invalidateStaleQueries(5 * 60 * 1000);
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  public teardownVisibilityBasedRefetching() {
    if (!this.visibilityChangeHandler) return;
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.visibilityChangeHandler = undefined;
  }

  /**
   * Setup automatic refetching when network status changes
   */
  public setupNetworkStatusRefetching() {
    // Clean up existing handler if it exists
    this.teardownNetworkStatusRefetching();
    
    // Create new handler
    this.networkStatusHandler = () => {
      console.log('Network connection restored, refreshing data...');
      this.reestablishSubscriptions();
    };
    
    window.addEventListener('online', this.networkStatusHandler);
  }

  public teardownNetworkStatusRefetching() {
    if (!this.networkStatusHandler) return;
    window.removeEventListener('online', this.networkStatusHandler);
    this.networkStatusHandler = undefined;
  }

  /**
   * Get all subscriptions grouped by table
   */
  public getSubscriptionsByTable(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    this.subscriptions.forEach((subscription, key) => {
      const [table] = key.split('::');
      if (!result[table]) {
        result[table] = [];
      }
      result[table].push(key);
    });
    
    return result;
  }

  /**
   * Get all active subscriptions
   */
  public getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get total number of active subscriptions
   */
  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStatus;
  }

  /**
   * Get subscription status for a specific table
   */
  public getSubscriptionStatus(table: string, queryKey: string | string[]): { isConnected: boolean, lastActivity: number } {
    const subscriptionKey = this.getSubscriptionKey(table, queryKey);
    
    const isConnected = this.subscriptions.has(subscriptionKey) && this.connectionStatus === 'connected';
    const lastActivity = this.tableLastActivity.get(subscriptionKey) || 0;
    
    return { isConnected, lastActivity };
  }

  /**
   * Force refresh subscriptions for specific tables
   */
  public forceRefreshSubscriptions(tables: string[]) {
    console.log(`Forcing refresh of subscriptions for tables: ${tables.join(', ')}`);
    
    // For each table, find all related subscriptions
    tables.forEach(table => {
      // Get all subscriptions for this table
      const subscriptionKeys = Array.from(this.subscriptions.keys())
        .filter(key => key.startsWith(`${table}::`));
      
      // For each subscription, unsubscribe and then resubscribe
      subscriptionKeys.forEach(key => {
        const subscription = this.subscriptions.get(key);
        if (subscription) {
          try {
            const { table, queryKey, filter, priority } = subscription.options;
            
            // Unsubscribe
            subscription.unsubscribe();
            this.subscriptions.delete(key);
            
            // Resubscribe
            this.subscribeToTable(table, queryKey, filter, priority);
            
            // Update activity timestamp to now
            this.tableLastActivity.set(key, Date.now());
          } catch (error) {
            console.error(`Error refreshing subscription ${key}:`, error);
          }
        }
      });
      
      // Invalidate queries related to this table
      // Prefer invalidating the actual query keys used by the subscription(s).
      // Fall back to invalidating by table name when we can't determine it.
      const keysForTable = Array.from(this.subscriptions.values())
        .filter((sub) => sub.options?.table === table)
        .map((sub) => JSON.stringify(this.normalizeQueryKey(sub.options?.queryKey ?? table)));
      if (keysForTable.length) {
        keysForTable.forEach((k) => {
          try {
            this.queryClient.invalidateQueries({ queryKey: JSON.parse(k) });
          } catch {
            this.queryClient.invalidateQueries({ queryKey: [table] });
          }
        });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [table] });
      }
    });

    this.updateSnapshot({ lastRefreshTime: Date.now() });
  }
}
