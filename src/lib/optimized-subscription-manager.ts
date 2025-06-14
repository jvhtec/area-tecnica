
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase-client";

/**
 * Optimized subscription manager that consolidates subscriptions and eliminates duplicates
 */
export class OptimizedSubscriptionManager {
  private static instance: OptimizedSubscriptionManager;
  private queryClient: QueryClient;
  private activeSubscriptions: Map<string, { 
    channel: any, 
    tables: Set<string>, 
    queryKeys: Set<string>,
    priority: 'high' | 'medium' | 'low',
    lastActivity: number
  }>;
  private connectionStatus: 'connected' | 'disconnected' | 'connecting';
  private consolidatedChannel: any = null;
  private subscriptionQueue: Map<string, any> = new Map();
  private batchTimer: number | null = null;

  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.activeSubscriptions = new Map();
    this.connectionStatus = 'connecting';
    this.setupConsolidatedChannel();
  }

  public static getInstance(queryClient: QueryClient): OptimizedSubscriptionManager {
    if (!OptimizedSubscriptionManager.instance) {
      OptimizedSubscriptionManager.instance = new OptimizedSubscriptionManager(queryClient);
    }
    return OptimizedSubscriptionManager.instance;
  }

  /**
   * Setup a single consolidated channel for all subscriptions
   */
  private setupConsolidatedChannel() {
    this.cleanup();
    
    this.consolidatedChannel = supabase.channel('consolidated-realtime');
    
    this.consolidatedChannel
      .on('system', { event: 'disconnect' }, () => {
        this.connectionStatus = 'disconnected';
        console.log('Consolidated channel disconnected');
        this.scheduleReconnection();
      })
      .on('system', { event: 'reconnected' }, () => {
        this.connectionStatus = 'connected';
        console.log('Consolidated channel reconnected');
        this.resubscribeAll();
      })
      .subscribe((status: string) => {
        console.log(`Consolidated channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.connectionStatus = 'disconnected';
          this.scheduleReconnection();
        }
      });
  }

  /**
   * Batch subscribe to multiple tables efficiently
   */
  public batchSubscribe(subscriptions: Array<{
    table: string;
    queryKey: string | string[];
    filter?: any;
    priority?: 'high' | 'medium' | 'low';
  }>) {
    // Add to queue
    subscriptions.forEach(sub => {
      const key = this.getSubscriptionKey(sub.table, sub.queryKey);
      this.subscriptionQueue.set(key, sub);
    });

    // Debounce batch processing
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = window.setTimeout(() => {
      this.processBatch();
    }, 100); // 100ms debounce
  }

  private processBatch() {
    if (this.subscriptionQueue.size === 0) return;

    console.log(`Processing batch of ${this.subscriptionQueue.size} subscriptions`);

    this.subscriptionQueue.forEach((subscription, key) => {
      this.addTableSubscription(
        subscription.table,
        subscription.queryKey,
        subscription.filter,
        subscription.priority || 'medium'
      );
    });

    this.subscriptionQueue.clear();
  }

  private addTableSubscription(
    table: string,
    queryKey: string | string[],
    filter?: any,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ) {
    if (!this.consolidatedChannel) {
      this.setupConsolidatedChannel();
    }

    const subscriptionKey = this.getSubscriptionKey(table, queryKey);
    
    // Check if already subscribed
    if (this.activeSubscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to ${table} with key ${subscriptionKey}`);
      return;
    }

    // Add postgres_changes listener for this table
    this.consolidatedChannel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
        ...filter
      },
      (payload: any) => {
        console.log(`Received ${payload.eventType} for ${table}:`, payload);
        
        // Update last activity
        const subscription = this.activeSubscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.lastActivity = Date.now();
        }

        // Invalidate queries based on priority
        this.invalidateQueriesOptimized(queryKey, priority);
      }
    );

    // Store subscription metadata
    this.activeSubscriptions.set(subscriptionKey, {
      channel: this.consolidatedChannel,
      tables: new Set([table]),
      queryKeys: new Set([Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey]),
      priority,
      lastActivity: Date.now()
    });

    console.log(`Added subscription for ${table} with priority ${priority}`);
  }

  /**
   * Optimized query invalidation based on priority
   */
  private invalidateQueriesOptimized(queryKey: string | string[], priority: 'high' | 'medium' | 'low') {
    const delay = priority === 'high' ? 0 : priority === 'medium' ? 50 : 200;
    
    setTimeout(() => {
      if (Array.isArray(queryKey)) {
        this.queryClient.invalidateQueries({ queryKey });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    }, delay);
  }

  private getSubscriptionKey(table: string, queryKey: string | string[]): string {
    const normalizedKey = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
    return `${table}::${normalizedKey}`;
  }

  private scheduleReconnection() {
    setTimeout(() => {
      if (this.connectionStatus === 'disconnected') {
        console.log('Attempting to reconnect...');
        this.setupConsolidatedChannel();
      }
    }, 2000);
  }

  private resubscribeAll() {
    console.log('Resubscribing to all tables after reconnection');
    const subscriptions = Array.from(this.activeSubscriptions.entries());
    this.activeSubscriptions.clear();
    
    subscriptions.forEach(([key, sub]) => {
      const [table] = key.split('::');
      const queryKey = Array.from(sub.queryKeys)[0];
      
      this.addTableSubscription(
        table,
        queryKey.startsWith('[') ? JSON.parse(queryKey) : queryKey,
        undefined,
        sub.priority
      );
    });
  }

  public cleanup() {
    if (this.consolidatedChannel) {
      supabase.removeChannel(this.consolidatedChannel);
      this.consolidatedChannel = null;
    }
    this.activeSubscriptions.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  public getStatus() {
    return {
      connectionStatus: this.connectionStatus,
      activeSubscriptions: this.activeSubscriptions.size,
      tables: Array.from(new Set(Array.from(this.activeSubscriptions.values()).flatMap(s => Array.from(s.tables))))
    };
  }
}
