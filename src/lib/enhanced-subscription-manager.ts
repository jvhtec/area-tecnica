import { QueryClient } from "@tanstack/react-query";
import { supabase, checkNetworkConnection } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export class EnhancedSubscriptionManager {
  private static instance: EnhancedSubscriptionManager;
  private queryClient: QueryClient;
  private subscriptions: Map<string, { 
    channel: RealtimeChannel;
    lastActivity: number;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    errorCount: number;
  }> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private healthCheckInterval: number | null = null;
  private reconnectAttempts: Map<string, number> = new Map();
  private lastNetworkCheck: number = Date.now();
  private networkCheckThrottle: number = 10000; // 10 seconds between connectivity checks
  
  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    this.setupConnectionMonitoring();
    this.startHealthCheck();
  }
  
  static getInstance(queryClient: QueryClient): EnhancedSubscriptionManager {
    if (!EnhancedSubscriptionManager.instance) {
      EnhancedSubscriptionManager.instance = new EnhancedSubscriptionManager(queryClient);
    }
    return EnhancedSubscriptionManager.instance;
  }
  
  private setupConnectionMonitoring(): void {
    // Monitor online/offline status with debounce to avoid rapid toggling
    let onlineTimeout: number | null = null;
    let offlineTimeout: number | null = null;
    
    window.addEventListener('online', () => {
      // Clear any pending offline timeout
      if (offlineTimeout !== null) {
        window.clearTimeout(offlineTimeout);
        offlineTimeout = null;
      }
      
      // Debounce online event to avoid flickering
      if (onlineTimeout === null) {
        onlineTimeout = window.setTimeout(() => {
          console.log('Network reconnected, reestablishing subscriptions');
          this.handleNetworkReconnection();
          onlineTimeout = null;
        }, 2000);
      }
    });
    
    window.addEventListener('offline', () => {
      // Clear any pending online timeout
      if (onlineTimeout !== null) {
        window.clearTimeout(onlineTimeout);
        onlineTimeout = null;
      }
      
      // Debounce offline event
      if (offlineTimeout === null) {
        offlineTimeout = window.setTimeout(() => {
          console.log('Network disconnected, marking subscriptions as disconnected');
          this.handleNetworkDisconnection();
          offlineTimeout = null;
        }, 2000);
      }
    });
    
    // Monitor tab visibility to check connections when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking subscription health');
        this.checkNetworkAndReconnect();
      }
    });
  }
  
  private handleNetworkReconnection(): void {
    this.connectionStatus = 'connecting';
    this.checkNetworkAndReconnect();
  }
  
  private handleNetworkDisconnection(): void {
    this.connectionStatus = 'disconnected';
    
    // Mark all subscriptions as disconnected
    this.subscriptions.forEach((sub, key) => {
      this.subscriptions.set(key, {
        ...sub,
        status: 'disconnected'
      });
    });
  }
  
  private async checkNetworkAndReconnect(): Promise<void> {
    // Throttle network checks to avoid too many requests
    const now = Date.now();
    if (now - this.lastNetworkCheck < this.networkCheckThrottle) {
      return;
    }
    this.lastNetworkCheck = now;
    
    try {
      // Simple connectivity check using the Supabase REST API endpoint
      // Use checkNetworkConnection from supabase-client for better consistency
      const isOnline = await checkNetworkConnection();
      
      if (isOnline) {
        // We have connectivity, check and repair subscriptions
        this.connectionStatus = 'connected';
        this.repairSubscriptions();
      } else {
        this.connectionStatus = 'disconnected';
      }
    } catch (error) {
      console.error('Error checking network connectivity:', error);
      this.connectionStatus = 'disconnected';
    }
  }
  
  private startHealthCheck(): void {
    // Clear any existing interval
    if (this.healthCheckInterval !== null) {
      window.clearInterval(this.healthCheckInterval);
    }
    
    // Set up a health check interval (every 30 seconds)
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }
  
  private performHealthCheck(): void {
    // Skip health check if we're offline
    if (this.connectionStatus === 'disconnected') {
      return;
    }
    
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    // Check each subscription
    this.subscriptions.forEach((sub, key) => {
      // If it's been over 5 minutes since last activity, check the subscription
      if (now - sub.lastActivity > staleThreshold || sub.status === 'error') {
        // If in error state or stale, attempt to reconnect
        this.reconnectSubscription(key);
      }
    });
  }
  
  private async reconnectSubscription(key: string): Promise<void> {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;
    
    // Get current attempt count with exponential backoff
    const attempts = this.reconnectAttempts.get(key) || 0;
    const backoffTime = Math.min(1000 * Math.pow(2, attempts), 300000); // Max 5 minutes
    
    // If we've tried recently, wait before trying again
    const now = Date.now();
    if (now - subscription.lastActivity < backoffTime) {
      return;
    }
    
    console.log(`Reconnecting subscription ${key} (attempt ${attempts + 1})`);
    
    // Remove the old subscription
    try {
      await supabase.removeChannel(subscription.channel);
    } catch (error) {
      console.error(`Error removing channel for ${key}:`, error);
    }
    
    // Extract table and query key information from the subscription key
    const [table, ...queryKeyParts] = key.split('::');
    const queryKey = queryKeyParts.join('::');
    
    // Create a new subscription
    try {
      // Create a new channel
      const newChannel = this.createChannel(table, queryKey);
      
      // Update the subscription record
      this.subscriptions.set(key, {
        channel: newChannel,
        lastActivity: now,
        status: 'connecting',
        errorCount: subscription.errorCount
      });
      
      // Increment reconnect attempt counter
      this.reconnectAttempts.set(key, attempts + 1);
      
      // Invalidate related queries to refresh data
      this.queryClient.invalidateQueries({ queryKey: [table] });
    } catch (error) {
      console.error(`Error reconnecting subscription ${key}:`, error);
      
      // Update status to error
      this.subscriptions.set(key, {
        ...subscription,
        status: 'error',
        errorCount: subscription.errorCount + 1
      });
    }
  }
  
  private repairSubscriptions(): void {
    // Check and repair all subscriptions that are in error or disconnected state
    this.subscriptions.forEach((sub, key) => {
      if (sub.status === 'error' || sub.status === 'disconnected') {
        this.reconnectSubscription(key);
      }
    });
  }
  
  private createChannel(table: string, queryKey: string): RealtimeChannel {
    // Create a channel with a unique name
    const channelName = `${table}-changes-${Date.now()}`;
    
    try {
      // Create the channel
      const channel = supabase.channel(channelName);
      
      // Set up the callback handler for real-time changes
      const handleChange = (payload: any) => {
        console.log(`Received ${payload.eventType} for ${table}:`, payload);
        
        // Update last activity time
        const subscription = this.subscriptions.get(`${table}::${queryKey}`);
        if (subscription) {
          this.subscriptions.set(`${table}::${queryKey}`, {
            ...subscription,
            lastActivity: Date.now(),
            status: 'connected',
            errorCount: 0
          });
        }
        
        // Reset reconnect attempts on successful data
        this.reconnectAttempts.delete(`${table}::${queryKey}`);
        
        // Invalidate related queries
        this.queryClient.invalidateQueries({ queryKey: [queryKey] });
      };
      
      // Subscribe to postgres changes
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        handleChange
      );
      
      // Subscribe to the channel
      channel.subscribe((status) => {
        console.log(`Subscription to ${table} status:`, status);
        
        const subscription = this.subscriptions.get(`${table}::${queryKey}`);
        if (!subscription) return;
        
        if (status === 'SUBSCRIBED') {
          this.subscriptions.set(`${table}::${queryKey}`, {
            ...subscription,
            status: 'connected',
            lastActivity: Date.now()
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`Error in subscription to ${table}`);
          this.subscriptions.set(`${table}::${queryKey}`, {
            ...subscription,
            status: 'error',
            errorCount: subscription.errorCount + 1
          });
        }
      });
      
      return channel;
    } catch (error) {
      console.error(`Error creating channel for ${table}:`, error);
      throw error;
    }
  }
  
  subscribeToTable(table: string, queryKey: string): { unsubscribe: () => void } {
    const subscriptionKey = `${table}::${queryKey}`;
    
    // If we already have this subscription, don't duplicate it
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`Subscription to ${table} for ${queryKey} already exists`);
      
      // Update the activity timestamp
      const subscription = this.subscriptions.get(subscriptionKey)!;
      this.subscriptions.set(subscriptionKey, {
        ...subscription,
        lastActivity: Date.now()
      });
      
      return {
        unsubscribe: () => this.unsubscribeFromTable(subscriptionKey)
      };
    }
    
    console.log(`Setting up subscription to ${table} for query key ${queryKey}`);
    
    // Create a new channel
    const channel = this.createChannel(table, queryKey);
    
    // Store the subscription
    this.subscriptions.set(subscriptionKey, {
      channel,
      lastActivity: Date.now(),
      status: 'connecting',
      errorCount: 0
    });
    
    return {
      unsubscribe: () => this.unsubscribeFromTable(subscriptionKey)
    };
  }
  
  unsubscribeFromTable(subscriptionKey: string): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      console.log(`Unsubscribing from ${subscriptionKey}`);
      
      try {
        supabase.removeChannel(subscription.channel);
      } catch (error) {
        console.error(`Error removing channel for ${subscriptionKey}:`, error);
      }
      
      this.subscriptions.delete(subscriptionKey);
      this.reconnectAttempts.delete(subscriptionKey);
    }
  }
  
  getSubscriptionStatus(table: string, queryKey: string): {
    isConnected: boolean;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastActivity: number;
    errorCount: number;
  } {
    const subscriptionKey = `${table}::${queryKey}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    
    if (!subscription) {
      return {
        isConnected: false,
        status: 'disconnected',
        lastActivity: 0,
        errorCount: 0
      };
    }
    
    return {
      isConnected: subscription.status === 'connected',
      status: subscription.status,
      lastActivity: subscription.lastActivity,
      errorCount: subscription.errorCount
    };
  }
  
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStatus;
  }
  
  getAllSubscriptionStatuses(): Record<string, {
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    lastActivity: number;
    errorCount: number;
  }> {
    const statuses: Record<string, any> = {};
    
    this.subscriptions.forEach((sub, key) => {
      statuses[key] = {
        status: sub.status,
        lastActivity: sub.lastActivity,
        errorCount: sub.errorCount
      };
    });
    
    return statuses;
  }
  
  resetAllSubscriptions(): void {
    console.log('Resetting all subscriptions');
    
    // Store all subscription keys to reconnect
    const keys = Array.from(this.subscriptions.keys());
    
    // Remove all subscriptions
    this.subscriptions.forEach((sub) => {
      try {
        supabase.removeChannel(sub.channel);
      } catch (error) {
        console.error('Error removing channel:', error);
      }
    });
    
    // Clear all subscriptions
    this.subscriptions.clear();
    this.reconnectAttempts.clear();
    
    // Reconnect all subscriptions
    keys.forEach(key => {
      const [table, queryKey] = key.split('::');
      this.subscribeToTable(table, queryKey);
    });
    
    // Reset reconnect attempts
    this.reconnectAttempts.clear();
    
    // Invalidate all queries to refresh data
    this.queryClient.invalidateQueries();
  }
}
