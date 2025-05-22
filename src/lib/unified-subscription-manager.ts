/**
 * Unified Subscription Manager
 * Centralized manager for all Supabase realtime subscriptions
 * Prevents duplicate subscriptions and ensures efficient resource usage
 */

import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type SubscriptionPriority = 'high' | 'medium' | 'low';
type QueryKeyType = string | (string | number)[];

interface SubscriptionOptions {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  filter?: string;
}

interface SubscriptionMetadata {
  id: string;
  table: string;
  queryKey: QueryKeyType;
  filter?: SubscriptionOptions;
  priority: SubscriptionPriority;
  channel: any;
  lastActivity: number;
  isConnected: boolean;
  errorCount: number;
  routes: Set<string>;
}

export class UnifiedSubscriptionManager {
  private static instance: UnifiedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, SubscriptionMetadata> = new Map();
  private subscriptionsByTable: Record<string, string[]> = {};
  private subscriptionsByQueryKey: Record<string, string[]> = {};
  private routeSubscriptions: Record<string, Set<string>> = {};
  private lastRefreshTime: number = Date.now();
  private connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' = 'CONNECTING';
  private pingIntervalId: number | null = null;
  private networkRetryTimeoutId: number | null = null;

  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupVisibilityBasedRefetching();
    this.setupNetworkStatusRefetching();
    this.setupRefreshEvents();
    this.startPingInterval();
  }

  public static getInstance(queryClient: QueryClient): UnifiedSubscriptionManager {
    if (!UnifiedSubscriptionManager.instance) {
      UnifiedSubscriptionManager.instance = new UnifiedSubscriptionManager(queryClient);
    } else if (queryClient) {
      // Update query client reference if provided
      UnifiedSubscriptionManager.instance.queryClient = queryClient;
    }
    return UnifiedSubscriptionManager.instance;
  }

  private getQueryKeyString(queryKey: QueryKeyType): string {
    if (typeof queryKey === 'string') {
      return queryKey;
    }
    return JSON.stringify(queryKey);
  }

  private getSubscriptionKey(table: string, queryKey: QueryKeyType, filter?: SubscriptionOptions): string {
    const queryKeyStr = this.getQueryKeyString(queryKey);
    const filterStr = filter ? JSON.stringify(filter) : '';
    return `${table}::${queryKeyStr}::${filterStr}`;
  }

  public subscribeToTable(
    table: string,
    queryKey: QueryKeyType,
    filter?: SubscriptionOptions,
    priority: SubscriptionPriority = 'medium'
  ) {
    const subscriptionKey = this.getSubscriptionKey(table, queryKey, filter);
    const queryKeyStr = this.getQueryKeyString(queryKey);

    // If subscription already exists, increment reference count and return existing
    if (this.subscriptions.has(subscriptionKey)) {
      const existing = this.subscriptions.get(subscriptionKey)!;
      console.log(`Reusing existing subscription for ${table} with key ${queryKeyStr}`);
      return {
        unsubscribe: () => {}
      };
    }

    console.log(`Creating new subscription for ${table} with key ${queryKeyStr}`);

    // Create Supabase channel for realtime subscription
    const channel = supabase.channel(`table-changes-${subscriptionKey}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        console.log(`Subscription presence sync: ${table}`);
      });
      
    // Add postgres changes listener
    channel
      .on('postgres_changes', {
        event: filter?.event || '*',
        schema: filter?.schema || 'public',
        table,
        filter: filter?.filter
      } as any, (payload: any) => {
        console.log(`Realtime change in ${table}:`, payload);

        // Record activity and update status
        const subscription = this.subscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.lastActivity = Date.now();
        }

        // Update shared state
        this.lastRefreshTime = Date.now();
        this.connectionStatus = 'CONNECTED';

        // Invalidate query cache based on queryKey
        this.invalidateQuery(queryKey);
      })
      .subscribe((status: string) => {
        console.log(`Subscription status for ${table}:`, status);
        
        const subscription = this.subscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.isConnected = status === 'SUBSCRIBED';
          
          if (status === 'SUBSCRIBED') {
            subscription.errorCount = 0;
          } else if (status === 'CHANNEL_ERROR') {
            subscription.errorCount += 1;
          }
        }
      });

    // Register subscription
    const metadata: SubscriptionMetadata = {
      id: subscriptionKey,
      table,
      queryKey,
      filter,
      priority,
      channel,
      lastActivity: Date.now(),
      isConnected: false,
      errorCount: 0,
      routes: new Set()
    };

    // Store in collections
    this.subscriptions.set(subscriptionKey, metadata);
    
    // Update table index
    if (!this.subscriptionsByTable[table]) {
      this.subscriptionsByTable[table] = [];
    }
    this.subscriptionsByTable[table].push(subscriptionKey);
    
    // Update queryKey index
    if (!this.subscriptionsByQueryKey[queryKeyStr]) {
      this.subscriptionsByQueryKey[queryKeyStr] = [];
    }
    this.subscriptionsByQueryKey[queryKeyStr].push(subscriptionKey);

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        this.unsubscribe(subscriptionKey, table, queryKeyStr);
      }
    };
  }

  public subscribeToTables(
    tables: Array<{
      table: string;
      queryKey: QueryKeyType;
      filter?: SubscriptionOptions;
      priority?: SubscriptionPriority;
    }>
  ) {
    const subscriptions = tables.map(({ table, queryKey, filter, priority }) => 
      this.subscribeToTable(table, queryKey, filter, priority || 'medium')
    );

    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      }
    };
  }

  private unsubscribe(subscriptionKey: string, table: string, queryKeyStr: string) {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    // Remove from route registrations
    if (subscription.routes.size === 0) {
      console.log(`Unsubscribing from ${table} with key ${queryKeyStr}`);

      // Remove from Supabase
      subscription.channel.unsubscribe();

      // Remove from our collections
      this.subscriptions.delete(subscriptionKey);
      
      // Remove from table index
      if (this.subscriptionsByTable[table]) {
        this.subscriptionsByTable[table] = this.subscriptionsByTable[table]
          .filter(key => key !== subscriptionKey);
        
        if (this.subscriptionsByTable[table].length === 0) {
          delete this.subscriptionsByTable[table];
        }
      }
      
      // Remove from queryKey index
      if (this.subscriptionsByQueryKey[queryKeyStr]) {
        this.subscriptionsByQueryKey[queryKeyStr] = this.subscriptionsByQueryKey[queryKeyStr]
          .filter(key => key !== subscriptionKey);
        
        if (this.subscriptionsByQueryKey[queryKeyStr].length === 0) {
          delete this.subscriptionsByQueryKey[queryKeyStr];
        }
      }
    }
  }

  public registerRouteSubscription(route: string, subscriptionKey: string) {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (!subscription) return;

    // Add route to subscription metadata
    subscription.routes.add(route);

    // Track route subscriptions
    if (!this.routeSubscriptions[route]) {
      this.routeSubscriptions[route] = new Set();
    }
    this.routeSubscriptions[route].add(subscriptionKey);
  }

  public cleanupRouteDependentSubscriptions(route: string) {
    const subscriptionKeys = this.routeSubscriptions[route];
    if (!subscriptionKeys) return;

    subscriptionKeys.forEach(key => {
      const subscription = this.subscriptions.get(key);
      if (subscription) {
        // Remove route from subscription
        subscription.routes.delete(route);

        // If no routes left and not a high priority subscription, unsubscribe
        if (subscription.routes.size === 0 && subscription.priority !== 'high') {
          this.unsubscribe(
            key, 
            subscription.table,
            this.getQueryKeyString(subscription.queryKey)
          );
        }
      }
    });

    // Clean up route tracking
    delete this.routeSubscriptions[route];
  }

  private invalidateQuery(queryKey: QueryKeyType) {
    if (typeof queryKey === 'string') {
      this.queryClient.invalidateQueries({ queryKey: [queryKey] });
    } else {
      this.queryClient.invalidateQueries({ queryKey });
    }
  }

  public getSubscriptionsByTable() {
    return { ...this.subscriptionsByTable };
  }

  public getSubscriptionStatus(table: string, queryKey: QueryKeyType) {
    const queryKeyStr = this.getQueryKeyString(queryKey);
    const keys = this.subscriptionsByTable[table] || [];
    
    // Find subscription matching both table and queryKey
    for (const key of keys) {
      const subscription = this.subscriptions.get(key);
      if (subscription && this.getQueryKeyString(subscription.queryKey) === queryKeyStr) {
        return {
          isConnected: subscription.isConnected,
          lastActivity: subscription.lastActivity,
          errorCount: subscription.errorCount
        };
      }
    }
    
    return {
      isConnected: false,
      lastActivity: 0,
      errorCount: 0
    };
  }

  public setupVisibilityBasedRefetching() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking for stale data');
        
        // Calculate time since last activity
        const now = Date.now();
        const timeSinceLastRefresh = now - this.lastRefreshTime;
        
        // If more than 2 minutes since last refresh, reestablish subscriptions
        if (timeSinceLastRefresh > 2 * 60 * 1000) {
          console.log('Tab was inactive for a while, reestablishing subscriptions');
          this.reestablishSubscriptions();
        }
      }
    });
  }

  public setupNetworkStatusRefetching() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('Network reconnected, reestablishing subscriptions');
      this.reestablishSubscriptions();
    });
    
    // Custom reconnect event listener
    window.addEventListener('supabase-reconnect', () => {
      console.log('Supabase reconnect requested, reestablishing subscriptions');
      this.reestablishSubscriptions();
    });
    
    // Force refresh event listener
    window.addEventListener('force-refresh-subscriptions', (event: any) => {
      const tables = event.detail?.tables;
      if (tables && Array.isArray(tables)) {
        console.log('Force refresh requested for tables:', tables);
        this.forceRefreshSubscriptions(tables);
      } else {
        console.log('Force refresh requested for all subscriptions');
        this.reestablishSubscriptions();
      }
    });
  }
  
  private setupRefreshEvents() {
    window.addEventListener('connection-restored', () => {
      console.log('Connection restored, invalidating queries');
      this.queryClient.invalidateQueries();
    });
  }
  
  private startPingInterval() {
    // Clear any existing interval
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    
    // Check connection health every minute
    this.pingIntervalId = window.setInterval(() => {
      this.pingConnection();
    }, 60000);
  }
  
  private async pingConnection() {
    try {
      // Fetch realtime status from supabase
      const { data } = await supabase.rpc('supabase_realtime_status');
      
      // Update connection status
      this.connectionStatus = data?.is_connected ? 'CONNECTED' : 'DISCONNECTED';
      
      // If disconnected, attempt to reconnect
      if (!data?.is_connected) {
        console.log('Realtime connection lost, attempting to reconnect');
        this.scheduleReconnect();
      }
    } catch (error) {
      console.error('Error pinging connection:', error);
      this.connectionStatus = 'DISCONNECTED';
      this.scheduleReconnect();
    }
  }
  
  private scheduleReconnect() {
    // Avoid multiple concurrent reconnect attempts
    if (this.networkRetryTimeoutId) {
      clearTimeout(this.networkRetryTimeoutId);
    }
    
    // Attempt reconnect with exponential backoff
    const backoff = Math.floor(Math.random() * 5000) + 1000; // 1-6s random backoff
    console.log(`Scheduling reconnect in ${backoff}ms`);
    
    this.networkRetryTimeoutId = window.setTimeout(() => {
      this.reestablishSubscriptions();
      this.networkRetryTimeoutId = null;
    }, backoff);
  }

  public reestablishSubscriptions() {
    console.log('Reestablishing all active subscriptions');
    
    // Update refresh time
    this.lastRefreshTime = Date.now();
    
    // Loop through active subscriptions
    this.subscriptions.forEach((metadata, key) => {
      try {
        // Unsubscribe from current channel
        if (metadata.channel) {
          metadata.channel.unsubscribe();
        }
        
        // Create new subscription with same parameters
        const { table, queryKey, filter, priority, routes } = metadata;
        
        // Create Supabase channel for realtime subscription
        const channel = supabase.channel(`table-changes-${key}-${Date.now()}`);
        
        // Add postgres changes listener
        channel.on('postgres_changes', {
          event: filter?.event || '*',
          schema: filter?.schema || 'public',
          table,
          filter: filter?.filter
        } as any, (payload: any) => {
          console.log(`Realtime change in ${table}:`, payload);
          
          // Record activity
          metadata.lastActivity = Date.now();
          this.lastRefreshTime = Date.now();
          
          // Invalidate query cache based on queryKey
          this.invalidateQuery(queryKey);
        })
        .subscribe();
          
        // Update metadata
        metadata.channel = channel;
        metadata.lastActivity = Date.now();
        
        // Invalidate related query to get fresh data
        this.invalidateQuery(queryKey);
      } catch (error) {
        console.error(`Error reestablishing subscription ${key}:`, error);
      }
    });
  }
  
  public forceRefreshSubscriptions(tables: string[]) {
    console.log(`Forcing refresh for tables: ${tables.join(', ')}`);
    
    // Update refresh time
    this.lastRefreshTime = Date.now();
    
    // Invalidate queries for each table
    tables.forEach(table => {
      const subscriptionKeys = this.subscriptionsByTable[table];
      if (subscriptionKeys) {
        subscriptionKeys.forEach(key => {
          const subscription = this.subscriptions.get(key);
          if (subscription) {
            // Invalidate related query
            this.invalidateQuery(subscription.queryKey);
            
            // Update activity timestamp
            subscription.lastActivity = Date.now();
          }
        });
      }
    });
  }
}
