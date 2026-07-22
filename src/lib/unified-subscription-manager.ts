import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { ChannelRetryManager } from "./subscription-retry";

import { queryKeys } from "@/lib/react-query";
import {
  buildSubscriptionKey,
  createInitialSubscriptionSnapshot,
  createSubscriptionDebugEntries,
  forceRefreshManagedSubscriptions,
  groupSubscriptionsByTable,
  normalizeQueryKey,
  type ManagedSubscription,
  type PendingManagedSubscription,
  type RealtimeChangePayload,
  type RealtimePayloadHandler,
  type RealtimeSubscriptionFilter,
  type SubscribeToTableOptions,
  type SubscriptionDebugEntry,
  type SubscriptionPriority,
  type SubscriptionSnapshot,
} from "@/lib/unified-subscription-support";

export type {
  RealtimeChangePayload,
  RealtimePayloadHandler,
  RealtimeSubscriptionFilter,
  SubscriptionDebugEntry,
  SubscriptionSnapshot,
} from "@/lib/unified-subscription-support";

/**
 * Enhanced subscription manager that centralizes all Supabase realtime subscriptions
 * and coordinates them with React Query cache invalidation
 */
export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, ManagedSubscription>;
  private pendingSubscriptions: Map<string, PendingManagedSubscription>;
  private routeSubscriptions: Map<string, Set<string>>;
  private lastReconnectAttempt: number;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting';
  private pingChannel: any | null;
  private tableLastActivity: Map<string, number>;
  private invalidationTimers: Map<string, number>;
  private channelRetryManager: ChannelRetryManager;
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
    this.channelRetryManager = new ChannelRetryManager();
    this.listeners = new Set();
    this.snapshot = createInitialSubscriptionSnapshot();
    
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
    return normalizeQueryKey(queryKey);
  }

  private getSubscriptionKey(table: string, queryKey: string | string[], filter?: RealtimeSubscriptionFilter) {
    return buildSubscriptionKey(table, queryKey, filter);
  }

  private addPayloadHandler(
    subscription: ManagedSubscription,
    handler: RealtimePayloadHandler,
    ownerRoute?: string,
  ) {
    const handlerId = Symbol(subscription.key);
    subscription.payloadHandlers.set(handlerId, handler);

    if (ownerRoute) {
      const ownerHandlers = subscription.payloadHandlerOwners.get(ownerRoute) ?? new Set<symbol>();
      ownerHandlers.add(handlerId);
      subscription.payloadHandlerOwners.set(ownerRoute, ownerHandlers);
    }

    return handlerId;
  }

  private removePayloadHandler(subscription: ManagedSubscription, handlerId: symbol) {
    subscription.payloadHandlers.delete(handlerId);
    subscription.payloadHandlerOwners.forEach((handlerIds, ownerRoute) => {
      handlerIds.delete(handlerId);
      if (handlerIds.size === 0) {
        subscription.payloadHandlerOwners.delete(ownerRoute);
      }
    });
  }

  private removePayloadHandlersForOwner(subscription: ManagedSubscription, ownerRoute: string) {
    const handlerIds = subscription.payloadHandlerOwners.get(ownerRoute);
    if (!handlerIds) {
      return;
    }

    handlerIds.forEach((handlerId) => {
      subscription.payloadHandlers.delete(handlerId);
    });
    subscription.payloadHandlerOwners.delete(ownerRoute);
  }

  private notifyPayloadHandlers(subscription: ManagedSubscription, payload: RealtimeChangePayload) {
    subscription.payloadHandlers.forEach((handler) => {
      try {
        const result = handler(payload);
        if (result && typeof result === 'object' && 'then' in result) {
          void Promise.resolve(result).catch((error) => {
            console.warn('[UnifiedSubscriptionManager] payload handler failed', error);
          });
        }
      } catch (error) {
        console.warn('[UnifiedSubscriptionManager] payload handler failed', error);
      }
    });
  }

  private getPayloadHandlerEntries(subscription: ManagedSubscription): PendingManagedSubscription['payloadHandlers'] {
    const handlerOwners = new Map<symbol, string>();

    subscription.payloadHandlerOwners.forEach((handlerIds, ownerRoute) => {
      handlerIds.forEach((handlerId) => {
        handlerOwners.set(handlerId, ownerRoute);
      });
    });

    return Array.from(subscription.payloadHandlers.entries()).map(([handlerId, handler]) => ({
      ownerRoute: handlerOwners.get(handlerId),
      handler,
    }));
  }

  private snapshotManagedSubscription(subscription: ManagedSubscription): PendingManagedSubscription {
    return {
      options: subscription.options,
      ownerRoutes: Array.from(subscription.ownerRoutes),
      payloadHandlers: this.getPayloadHandlerEntries(subscription),
      invalidateOnPayload: subscription.invalidateOnPayload,
    };
  }

  private replayPendingSubscription(pendingSubscription: PendingManagedSubscription) {
    const { options, ownerRoutes, payloadHandlers, invalidateOnPayload } = pendingSubscription;
    const subscription = this.subscribeToTable(
      options.table,
      options.queryKey,
      options.filter,
      options.priority,
      { invalidateOnPayload },
    );

    ownerRoutes.forEach((ownerRoute) => {
      this.registerRouteSubscription(ownerRoute, subscription.key);
    });

    payloadHandlers.forEach(({ ownerRoute, handler }) => {
      this.subscribeToTable(
        options.table,
        options.queryKey,
        options.filter,
        options.priority,
        {
          ownerRoute,
          onPayload: handler,
          invalidateOnPayload,
        },
      );
    });

    return subscription;
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
      activeConnections: this.getSubscriptionCount(),
      queuedSubscriptions: this.pendingSubscriptions.size,
      subscriptionsByTable: this.getSubscriptionsByTable(),
      debugSubscriptions: this.getSubscriptionDebugEntries(),
      lastHealthCheck: Date.now(),
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
            void pingChannel.track({ online_at: new Date().toISOString() }).catch((error) => {
              console.warn('Ping channel presence track failed:', error);
            });
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

  public refreshStaleSubscriptions(maxAgeMs = 5 * 60 * 1000) {
    this.invalidateStaleQueries(maxAgeMs);
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
      this.pendingSubscriptions.set(key, this.snapshotManagedSubscription(subscription));
    });
    
    // Clean up existing subscriptions
    this.unsubscribeAll(false);
    
    // Resubscribe to all tables
    this.pendingSubscriptions.forEach((pendingSubscription, key) => {
      this.replayPendingSubscription(pendingSubscription);
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
          this.removePayloadHandlersForOwner(subscription, route);
          subscription.unsubscribe();
          this.subscriptions.delete(key);
        }
      } else {
        console.log(`Keeping subscription to ${key} as it's used by other routes`);
        const subscription = this.subscriptions.get(key);
        if (subscription) {
          this.removePayloadHandlersForOwner(subscription, route);
          subscription.ownerRoutes.delete(route);
        }
      }
    });
    
    // Clear the route's subscription list
    this.routeSubscriptions.delete(route);
    this.refreshSnapshotFromState();
  }

  /**
   * Subscribe to a single table with intelligent cache invalidation
   */
  public subscribeToTable(
    table: string, 
    queryKey: string | string[], 
    filter?: RealtimeSubscriptionFilter,
    priority: SubscriptionPriority = 'medium',
    options: SubscribeToTableOptions = {},
  ) {
    const subscriptionKey = this.getSubscriptionKey(table, queryKey, filter);
    
    // Check if we already have this subscription (deduplication)
    if (this.subscriptions.has(subscriptionKey)) {
      const existingSubscription = this.subscriptions.get(subscriptionKey);
      if (existingSubscription) {
        if (options.invalidateOnPayload !== false) {
          existingSubscription.invalidateOnPayload = true;
        }
        if (options.ownerRoute) {
          this.registerRouteSubscription(options.ownerRoute, subscriptionKey);
        }
        const handlerId = options.onPayload
          ? this.addPayloadHandler(existingSubscription, options.onPayload, options.ownerRoute)
          : null;

        if (handlerId) {
          return {
            ...existingSubscription,
            unsubscribe: () => {
              const currentSubscription = this.subscriptions.get(subscriptionKey);
              if (currentSubscription) {
                this.removePayloadHandler(currentSubscription, handlerId);
              }
            },
          };
        }
      }

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
      
      channel
        .on('postgres_changes', subscriptionConfig, (payload) => {
          // Reduced logging for performance
          if (priority === 'high') {
            console.log(`Received ${payload.eventType} for ${table}:`, payload);
          }
          
          // Update last activity timestamp
          this.tableLastActivity.set(subscriptionKey, Date.now());

          const subscription = this.subscriptions.get(subscriptionKey);
          if (subscription) {
            subscription.lastPayloadAt = Date.now();
            subscription.invalidationCount += 1;
            this.notifyPayloadHandlers(subscription, payload as RealtimeChangePayload);
          }
          
          // Invalidate React Query cache based on the query key
          if (subscription?.invalidateOnPayload ?? true) {
            this.scheduleInvalidation(queryKey, priority);
          }
          this.refreshSnapshotFromState();
        })
        .subscribe((status) => {
          console.log(`Channel ${channelName} status:`, status);

          if (status === 'SUBSCRIBED') {
            this.channelRetryManager.clear(subscriptionKey);
          }
          
          if (status === 'CHANNEL_ERROR') {
            const retryResult = this.channelRetryManager.schedule(
              subscriptionKey,
              () => this.retrySubscription(subscriptionKey, table),
              () => this.markSubscriptionRetryExhausted(table),
            );

            if (retryResult.state !== "scheduled") return;

            const retryDelay = retryResult.delayMs;
            if (table !== 'job_departments') {
              console.error(`Error subscribing to ${table}, retrying in ${retryDelay}ms...`);
            } else {
              console.warn(`Transient subscription error for ${table}, retrying in ${retryDelay}ms...`);
            }
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
          this.channelRetryManager.clear(subscriptionKey);
          this.routeSubscriptions.forEach((keys) => keys.delete(subscriptionKey));
          this.refreshSnapshotFromState();
        },
        options: { table, queryKey, filter, priority },
        ownerRoutes: new Set(),
        payloadHandlers: new Map(),
        payloadHandlerOwners: new Map(),
        invalidateOnPayload: options.invalidateOnPayload !== false,
        createdAt: Date.now(),
        lastPayloadAt: null,
        invalidationCount: 0,
      };

      this.routeSubscriptions.forEach((keys, route) => {
        if (keys.has(subscriptionKey)) {
          subscription.ownerRoutes.add(route);
        }
      });

      if (options.ownerRoute) {
        if (!this.routeSubscriptions.has(options.ownerRoute)) {
          this.routeSubscriptions.set(options.ownerRoute, new Set());
        }
        this.routeSubscriptions.get(options.ownerRoute)?.add(subscriptionKey);
        subscription.ownerRoutes.add(options.ownerRoute);
      }

      const handlerId = options.onPayload
        ? this.addPayloadHandler(subscription, options.onPayload, options.ownerRoute)
        : null;

      this.subscriptions.set(subscriptionKey, subscription);
      this.tableLastActivity.set(subscriptionKey, Date.now());
      this.refreshSnapshotFromState();
      
      if (handlerId) {
        return {
          ...subscription,
          unsubscribe: () => {
            const currentSubscription = this.subscriptions.get(subscriptionKey);
            if (currentSubscription) {
              this.removePayloadHandler(currentSubscription, handlerId);
            }
          },
        };
      }

      return subscription;
    } catch (error) {
      console.error(`Error creating subscription for ${table}:`, error);
      this.snapshot.failedConnections += 1;
      this.refreshSnapshotFromState();

      // Return dummy subscription
      const fallbackSubscription: ManagedSubscription = {
        key: subscriptionKey,
        unsubscribe: () => {},
        options: { table, queryKey, filter, priority },
        ownerRoutes: new Set(),
        payloadHandlers: new Map(),
        payloadHandlerOwners: new Map(),
        invalidateOnPayload: options.invalidateOnPayload !== false,
        createdAt: Date.now(),
        lastPayloadAt: null,
        invalidationCount: 0,
      };

      return fallbackSubscription;
    }
  }

  private retrySubscription(subscriptionKey: string, table: string) {
    const sub = this.subscriptions.get(subscriptionKey);
    if (!sub) return;
    console.log(`Retrying subscription to ${table}`);
    const pendingSubscription = this.snapshotManagedSubscription(sub);
    try {
      sub.unsubscribe();
    } catch (e) {
      console.error('Error unsubscribing during retry:', e);
    }
    this.subscriptions.delete(subscriptionKey);
    this.replayPendingSubscription(pendingSubscription);
  }

  private markSubscriptionRetryExhausted(table: string) {
    console.error(`Subscription to ${table} failed after repeated retry attempts.`);
    this.snapshot.failedConnections += 1;
    this.refreshSnapshotFromState();
  }

  /**
   * Register a subscription with a specific route
   */
  public registerRouteSubscription(route: string, subscriptionKey: string) {
    if (!this.routeSubscriptions.has(route)) {
      this.routeSubscriptions.set(route, new Set());
    }
    
    this.routeSubscriptions.get(route)?.add(subscriptionKey);
    this.subscriptions.get(subscriptionKey)?.ownerRoutes.add(route);
    this.refreshSnapshotFromState();
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
      this.routeSubscriptions.clear();
    }
  }

  /**
   * Get all subscriptions grouped by table
   */
  public getSubscriptionsByTable(): Record<string, string[]> {
    return groupSubscriptionsByTable(this.subscriptions);
  }

  public getSubscriptionDebugEntries(): SubscriptionDebugEntry[] {
    return createSubscriptionDebugEntries(this.subscriptions);
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
    forceRefreshManagedSubscriptions(tables, {
      subscriptions: this.subscriptions,
      tableLastActivity: this.tableLastActivity,
      snapshotSubscription: (subscription) => this.snapshotManagedSubscription(subscription),
      replaySubscription: (subscription) => this.replayPendingSubscription(subscription),
      invalidateQuery: (queryKey) => this.queryClient.invalidateQueries({
        queryKey: queryKey.length === 1 ? queryKeys.custom(queryKey[0]) : queryKey,
      }),
    });

    this.updateSnapshot({ lastRefreshTime: Date.now() });
  }
}
