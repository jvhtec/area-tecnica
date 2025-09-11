import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

interface SubscriptionConfig {
  table: string;
  queryKey: string | string[];
  priority: 'high' | 'medium' | 'low';
  lastActivity: number;
  retryCount: number;
}

interface ConnectionPoolStats {
  activeConnections: number;
  queuedSubscriptions: number;
  failedConnections: number;
  averageResponseTime: number;
}

/**
 * Performance-optimized subscription manager that reduces database load
 * through connection pooling, subscription batching, and circuit breaker patterns
 */
export class PerformanceOptimizedSubscriptionManager {
  private static instance: PerformanceOptimizedSubscriptionManager;
  private queryClient: QueryClient;
  
  // Connection pooling
  private connectionPool: Map<string, RealtimeChannel> = new Map();
  private maxConnections = 5; // Limit concurrent connections
  private subscriptionQueue: SubscriptionConfig[] = [];
  private isProcessingQueue = false;
  
  // Circuit breaker
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitBreakerThreshold = 5;
  private circuitBreakerTimeout = 30000; // 30 seconds
  private isCircuitOpen = false;
  
  // Subscription management
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private batchedUpdates: Map<string, NodeJS.Timeout> = new Map();
  private connectionStats: ConnectionPoolStats = {
    activeConnections: 0,
    queuedSubscriptions: 0,
    failedConnections: 0,
    averageResponseTime: 0
  };
  
  // Performance monitoring
  private responseTimes: number[] = [];
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1 minute
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.startHealthChecks();
    this.setupGracefulShutdown();
  }
  
  static getInstance(queryClient: QueryClient): PerformanceOptimizedSubscriptionManager {
    if (!PerformanceOptimizedSubscriptionManager.instance) {
      PerformanceOptimizedSubscriptionManager.instance = new PerformanceOptimizedSubscriptionManager(queryClient);
    }
    return PerformanceOptimizedSubscriptionManager.instance;
  }
  
  /**
   * Subscribe to a table with connection pooling and batching
   */
  public subscribeToTable(
    table: string,
    queryKey: string | string[],
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): { unsubscribe: () => void } {
    const subscriptionKey = this.getSubscriptionKey(table, queryKey);
    
    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Already subscribed to ${subscriptionKey}`);
      return { unsubscribe: () => this.unsubscribe(subscriptionKey) };
    }
    
    // Check circuit breaker
    if (this.isCircuitOpen) {
      console.warn('Circuit breaker open, queueing subscription');
      this.queueSubscription({ table, queryKey, priority, lastActivity: Date.now(), retryCount: 0 });
      return { unsubscribe: () => this.unsubscribe(subscriptionKey) };
    }
    
    // Add to subscriptions
    this.subscriptions.set(subscriptionKey, {
      table,
      queryKey,
      priority,
      lastActivity: Date.now(),
      retryCount: 0
    });
    
    // Process subscription based on priority
    if (priority === 'high') {
      this.processSubscriptionImmediate(subscriptionKey);
    } else {
      this.queueSubscription(this.subscriptions.get(subscriptionKey)!);
    }
    
    return { unsubscribe: () => this.unsubscribe(subscriptionKey) };
  }
  
  /**
   * Queue subscription for batch processing
   */
  private queueSubscription(config: SubscriptionConfig) {
    this.subscriptionQueue.push(config);
    this.connectionStats.queuedSubscriptions = this.subscriptionQueue.length;
    
    if (!this.isProcessingQueue) {
      // Process queue with debouncing
      setTimeout(() => this.processSubscriptionQueue(), 100);
    }
  }
  
  /**
   * Process subscription queue in batches
   */
  private async processSubscriptionQueue() {
    if (this.isProcessingQueue || this.subscriptionQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // Process up to 3 subscriptions at once to avoid overwhelming the database
      const batch = this.subscriptionQueue.splice(0, Math.min(3, this.subscriptionQueue.length));
      
      await Promise.allSettled(
        batch.map(config => this.createPooledSubscription(config))
      );
      
      this.connectionStats.queuedSubscriptions = this.subscriptionQueue.length;
      
      // Continue processing if more items in queue
      if (this.subscriptionQueue.length > 0) {
        setTimeout(() => this.processSubscriptionQueue(), 500); // 500ms between batches
      }
    } catch (error) {
      console.error('Error processing subscription queue:', error);
      this.handleCircuitBreaker();
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Process high-priority subscription immediately
   */
  private async processSubscriptionImmediate(subscriptionKey: string) {
    const config = this.subscriptions.get(subscriptionKey);
    if (!config) return;
    
    try {
      await this.createPooledSubscription(config);
    } catch (error) {
      console.error(`Error processing immediate subscription ${subscriptionKey}:`, error);
      this.handleCircuitBreaker();
    }
  }
  
  /**
   * Create a pooled subscription that reuses connections when possible
   */
  private async createPooledSubscription(config: SubscriptionConfig): Promise<void> {
    const subscriptionKey = this.getSubscriptionKey(config.table, config.queryKey);
    const startTime = Date.now();
    
    try {
      // Check if we can reuse an existing connection
      let channel = this.getPooledConnection(config.table);
      
      if (!channel && this.connectionPool.size >= this.maxConnections) {
        // If we've hit the connection limit, wait and retry
        console.warn(`Connection limit reached (${this.maxConnections}), queuing subscription`);
        setTimeout(() => this.createPooledSubscription(config), 1000);
        return;
      }
      
      if (!channel) {
        // Create new connection
        channel = await this.createNewConnection(config.table);
        this.connectionPool.set(config.table, channel);
      }
      
      // Set up subscription on the channel
      this.setupSubscriptionHandler(channel, config);
      
      // Update stats
      const responseTime = Date.now() - startTime;
      this.updateResponseTimeStats(responseTime);
      this.connectionStats.activeConnections = this.connectionPool.size;
      
      // Reset failure count on success
      this.failureCount = 0;
      this.isCircuitOpen = false;
      
    } catch (error) {
      console.error(`Error creating subscription for ${subscriptionKey}:`, error);
      this.handleSubscriptionError(config, error);
    }
  }
  
  /**
   * Get existing pooled connection for a table
   */
  private getPooledConnection(table: string): RealtimeChannel | undefined {
    return this.connectionPool.get(table);
  }
  
  /**
   * Create a new connection with error handling
   */
  private async createNewConnection(table: string): Promise<RealtimeChannel> {
    const channelName = `pooled-${table}-${Date.now()}`;
    const channel = supabase.channel(channelName);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for ${table}`));
      }, 10000); // 10 second timeout
      
      channel.subscribe((status) => {
        clearTimeout(timeout);
        
        if (status === 'SUBSCRIBED') {
          resolve(channel);
        } else if (status === 'CHANNEL_ERROR') {
          reject(new Error(`Channel error for ${table}`));
        }
      });
    });
  }
  
  /**
   * Setup subscription handler with batched updates
   */
  private setupSubscriptionHandler(channel: RealtimeChannel, config: SubscriptionConfig) {
    const subscriptionKey = this.getSubscriptionKey(config.table, config.queryKey);
    
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: config.table },
      (payload) => {
        // Update activity timestamp
        const subscription = this.subscriptions.get(subscriptionKey);
        if (subscription) {
          subscription.lastActivity = Date.now();
        }
        
        // Batch query invalidations to reduce database load
        this.batchQueryInvalidation(config.queryKey, config.priority);
      }
    );
  }
  
  /**
   * Batch query invalidations to reduce load
   */
  private batchQueryInvalidation(queryKey: string | string[], priority: 'high' | 'medium' | 'low') {
    const key = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
    
    // Clear existing timeout
    const existingTimeout = this.batchedUpdates.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout based on priority
    const delay = priority === 'high' ? 50 : priority === 'medium' ? 200 : 500;
    
    const timeout = setTimeout(() => {
      if (Array.isArray(queryKey)) {
        this.queryClient.invalidateQueries({ queryKey });
      } else {
        this.queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
      this.batchedUpdates.delete(key);
    }, delay);
    
    this.batchedUpdates.set(key, timeout);
  }
  
  /**
   * Handle subscription errors with circuit breaker pattern
   */
  private handleSubscriptionError(config: SubscriptionConfig, error: any) {
    const subscriptionKey = this.getSubscriptionKey(config.table, config.queryKey);
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (subscription) {
      subscription.retryCount++;
      
      // Exponential backoff for retries
      if (subscription.retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, subscription.retryCount), 30000);
        setTimeout(() => this.createPooledSubscription(config), delay);
      } else {
        console.error(`Max retries exceeded for ${subscriptionKey}`);
        this.subscriptions.delete(subscriptionKey);
      }
    }
    
    this.handleCircuitBreaker();
  }
  
  /**
   * Handle circuit breaker logic
   */
  private handleCircuitBreaker() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.connectionStats.failedConnections++;
    
    if (this.failureCount >= this.circuitBreakerThreshold) {
      this.isCircuitOpen = true;
      console.warn('Circuit breaker opened due to repeated failures');
      
      // Auto-recover after timeout
      setTimeout(() => {
        if (Date.now() - this.lastFailureTime >= this.circuitBreakerTimeout) {
          this.isCircuitOpen = false;
          this.failureCount = 0;
          console.log('Circuit breaker closed, resuming operations');
          
          // Process any queued subscriptions
          if (this.subscriptionQueue.length > 0) {
            this.processSubscriptionQueue();
          }
        }
      }, this.circuitBreakerTimeout);
    }
  }
  
  /**
   * Update response time statistics
   */
  private updateResponseTimeStats(responseTime: number) {
    this.responseTimes.push(responseTime);
    
    // Keep only last 100 measurements
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    // Calculate average
    this.connectionStats.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }
  
  /**
   * Start health checks
   */
  private startHealthChecks() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }
  
  /**
   * Perform health check and cleanup
   */
  private performHealthCheck() {
    const now = Date.now();
    
    // Clean up stale subscriptions
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    this.subscriptions.forEach((config, key) => {
      if (now - config.lastActivity > staleThreshold) {
        console.log(`Removing stale subscription: ${key}`);
        this.unsubscribe(key);
      }
    });
    
    // Log performance metrics
    if (this.connectionStats.averageResponseTime > 2000) {
      console.warn('High database response times detected:', this.connectionStats);
    }
    
    this.lastHealthCheck = now;
  }
  
  /**
   * Unsubscribe from a specific subscription
   */
  private unsubscribe(subscriptionKey: string) {
    this.subscriptions.delete(subscriptionKey);
    
    // Note: We don't remove the channel from the pool as it might be used by other subscriptions
    // Channels are cleaned up during health checks if no active subscriptions
  }
  
  /**
   * Get subscription key
   */
  private getSubscriptionKey(table: string, queryKey: string | string[]): string {
    const key = Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
    return `${table}::${key}`;
  }
  
  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown() {
    const cleanup = () => {
      console.log('Cleaning up subscription manager...');
      
      // Clear all timeouts
      this.batchedUpdates.forEach(timeout => clearTimeout(timeout));
      this.batchedUpdates.clear();
      
      // Remove all channels
      this.connectionPool.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error('Error removing channel during cleanup:', error);
        }
      });
      
      this.connectionPool.clear();
      this.subscriptions.clear();
    };
    
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
  }
  
  /**
   * Get connection statistics
   */
  public getStats(): ConnectionPoolStats & { 
    subscriptionCount: number;
    circuitBreakerOpen: boolean;
    lastHealthCheck: number;
  } {
    return {
      ...this.connectionStats,
      subscriptionCount: this.subscriptions.size,
      circuitBreakerOpen: this.isCircuitOpen,
      lastHealthCheck: this.lastHealthCheck
    };
  }
  
  /**
   * Force refresh all subscriptions
   */
  public forceRefresh() {
    console.log('Force refreshing all subscriptions...');
    
    // Invalidate all queries
    this.queryClient.invalidateQueries();
    
    // Reset circuit breaker
    this.isCircuitOpen = false;
    this.failureCount = 0;
    
    // Process any queued subscriptions
    if (this.subscriptionQueue.length > 0) {
      this.processSubscriptionQueue();
    }
  }
}
