
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, { unsubscribe: () => void }> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private pendingSubscriptions: Map<string, { table: string, queryKey: string | string[] }> = new Map();
  private lastReconnectAttempt: number = 0;
  private reconnectTimeoutId: number | null = null;
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupConnectionMonitoring();
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
  }
  
  private handleOnline() {
    console.log('Network reconnected, reestablishing Supabase subscriptions');
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
    this.subscriptions.forEach((_, key) => {
      const [table, serializedKey] = key.split('::');
      const queryKey = serializedKey ? JSON.parse(serializedKey) : table;
      this.pendingSubscriptions.set(key, { table, queryKey });
    });
    
    // Clear existing subscriptions
    this.unsubscribeAll();
    
    // Resubscribe to all tables
    this.pendingSubscriptions.forEach(({ table, queryKey }, key) => {
      this.subscribeToTable(table, queryKey);
      this.pendingSubscriptions.delete(key);
    });
    
    this.connectionStatus = 'connected';
    console.log('Supabase subscriptions reestablished');
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
    const serializedKey = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
    const subscriptionKey = `${table}::${serializedKey}`;
    
    // If we already have this subscription, don't duplicate it
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Subscription to ${table} for ${serializedKey} already exists`);
      return {
        unsubscribe: () => this.unsubscribeFromTable(table, queryKey)
      };
    }
    
    console.log(`Setting up subscription to ${table} for query key ${serializedKey}`);
    
    const channel = supabase.channel(`${table}-changes-${Date.now()}`)
      .on(
        'postgres_changes',
        { 
          event: filter?.event || '*', 
          schema: filter?.schema || 'public', 
          table,
          ...(filter?.filter ? { filter: filter.filter } : {})
        },
        async (payload) => {
          console.log(`Received ${payload.eventType} for ${table}:`, payload);
          
          // Intelligently invalidate only affected queries
          const keys = Array.isArray(queryKey) ? queryKey : [queryKey];
          
          // Batch invalidations to prevent UI thrashing
          setTimeout(() => {
            keys.forEach(key => {
              this.queryClient.invalidateQueries({ queryKey: [key] });
            });
            console.log(`Invalidated queries for keys: ${keys.join(', ')}`);
          }, 50);
        }
      )
      .subscribe((status) => {
        console.log(`Subscription to ${table} status:`, status);
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error in subscription to ${table}`);
          // Queue for reconnection
          this.pendingSubscriptions.set(subscriptionKey, { table, queryKey });
          this.handleOffline();
        }
      });
    
    // Store the subscription for later cleanup
    this.subscriptions.set(subscriptionKey, { 
      unsubscribe: () => {
        console.log(`Removing subscription to ${table} for ${serializedKey}`);
        supabase.removeChannel(channel);
      }
    });
    
    return {
      unsubscribe: () => this.unsubscribeFromTable(table, queryKey)
    };
  }
  
  /**
   * Subscribe to multiple tables at once
   * @param tables Array of table names and query keys
   * @returns An object with an unsubscribe method for all subscriptions
   */
  subscribeToTables(tables: Array<{ table: string, queryKey: string | string[] }>) {
    const unsubscribeFunctions: Array<() => void> = [];
    
    tables.forEach(({ table, queryKey }) => {
      const { unsubscribe } = this.subscribeToTable(table, queryKey);
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
