
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';

/**
 * Hook for efficiently managing Supabase table subscriptions with prioritization
 * @param subscription Configuration for the subscription
 * @returns Subscription status and control methods
 */
export function useOptimizedSubscription(
  subscription: {
    table: string;
    queryKey: string | string[];
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
      schema?: string;
      filter?: string;
    };
    priority?: 'high' | 'medium' | 'low';
    enabled?: boolean;
  }
) {
  const { table, queryKey, filter, priority = 'medium', enabled = true } = subscription;
  const queryClient = useQueryClient();
  const subscriptionManager = UnifiedSubscriptionManager.getInstance(queryClient);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  
  const [status, setStatus] = useState({
    isConnected: false,
    lastActivity: 0,
    isStale: false
  });

  // Set up and manage subscription lifecycle
  useEffect(() => {
    if (!enabled) {
      if (subscriptionRef.current) {
        console.log(`Unsubscribing from ${table} (disabled)`);
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      return;
    }
    
    // Create subscription if it doesn't exist
    if (!subscriptionRef.current) {
      console.log(`Creating subscription to ${table} (priority: ${priority})`);
      subscriptionRef.current = subscriptionManager.subscribeToTable(
        table,
        queryKey,
        filter,
        priority
      );
    }
    
    // Check subscription status periodically
    const statusInterval = setInterval(() => {
      if (!subscriptionRef.current) return;
      
      const subStatus = subscriptionManager.getSubscriptionStatus(table, queryKey);
      const isStale = Date.now() - subStatus.lastActivity > 5 * 60 * 1000; // 5 minutes
      
      setStatus({
        isConnected: subStatus.isConnected,
        lastActivity: subStatus.lastActivity,
        isStale
      });
      
      // Auto-refresh if stale (only for high priority)
      if (isStale && priority === 'high') {
        console.log(`Auto-refreshing stale high priority subscription to ${table}`);
        resetSubscription();
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(statusInterval);
      if (subscriptionRef.current) {
        console.log(`Cleaning up subscription to ${table}`);
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [enabled, table, queryKey, priority, filter]);

  // Function to manually reset the subscription
  const resetSubscription = () => {
    if (subscriptionRef.current) {
      console.log(`Manually resetting subscription to ${table}`);
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    
    subscriptionRef.current = subscriptionManager.subscribeToTable(
      table,
      queryKey,
      filter,
      priority
    );
    
    // Invalidate the associated queries
    queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
    
    setStatus(prev => ({
      ...prev,
      lastActivity: Date.now(),
      isStale: false
    }));
  };

  return {
    ...status,
    resetSubscription,
    isEnabled: enabled,
    table,
    priority
  };
}

/**
 * Hook for efficiently managing multiple table subscriptions
 * @param subscriptions Array of table subscriptions to manage
 * @returns Combined subscription status and control methods
 */
export function useOptimizedMultiTableSubscription(
  subscriptions: Array<{
    table: string;
    queryKey: string | string[];
    filter?: {
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
      schema?: string;
      filter?: string;
    };
    priority?: 'high' | 'medium' | 'low';
    enabled?: boolean;
  }>
) {
  const queryClient = useQueryClient();
  const subscriptionManager = UnifiedSubscriptionManager.getInstance(queryClient);
  const subscriptionsRef = useRef<{ table: string; unsubscribe: () => void }[]>([]);
  
  const [status, setStatus] = useState({
    isAllConnected: false,
    hasStaleSubscriptions: false,
    subscriptionCount: 0
  });

  // Set up and manage subscription lifecycle
  useEffect(() => {
    // Clear any existing subscriptions
    if (subscriptionsRef.current.length > 0) {
      subscriptionsRef.current.forEach(sub => {
        console.log(`Cleaning up existing subscription to ${sub.table}`);
        sub.unsubscribe();
      });
      subscriptionsRef.current = [];
    }
    
    // Create new subscriptions for enabled configs
    const enabledSubscriptions = subscriptions.filter(sub => sub.enabled !== false);
    
    console.log(`Setting up ${enabledSubscriptions.length} table subscriptions`);
    
    enabledSubscriptions.forEach(sub => {
      const subscription = subscriptionManager.subscribeToTable(
        sub.table,
        sub.queryKey,
        sub.filter,
        sub.priority || 'medium'
      );
      
      subscriptionsRef.current.push({
        table: sub.table,
        unsubscribe: subscription.unsubscribe
      });
    });
    
    // Check subscriptions status periodically
    const statusInterval = setInterval(() => {
      let allConnected = true;
      let hasStale = false;
      
      enabledSubscriptions.forEach(sub => {
        const subStatus = subscriptionManager.getSubscriptionStatus(sub.table, sub.queryKey);
        
        if (!subStatus.isConnected) {
          allConnected = false;
        }
        
        if (Date.now() - subStatus.lastActivity > 5 * 60 * 1000) {
          hasStale = true;
        }
      });
      
      setStatus({
        isAllConnected: allConnected,
        hasStaleSubscriptions: hasStale,
        subscriptionCount: subscriptionsRef.current.length
      });
      
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(statusInterval);
      subscriptionsRef.current.forEach(sub => {
        console.log(`Cleaning up subscription to ${sub.table}`);
        sub.unsubscribe();
      });
      subscriptionsRef.current = [];
    };
  }, [JSON.stringify(subscriptions)]); // Dependency on stringified subscriptions array

  // Function to manually reset all subscriptions
  const resetAllSubscriptions = () => {
    console.log('Manually resetting all subscriptions');
    
    // Clean up existing subscriptions
    subscriptionsRef.current.forEach(sub => sub.unsubscribe());
    subscriptionsRef.current = [];
    
    // Create new subscriptions
    subscriptions.filter(sub => sub.enabled !== false).forEach(sub => {
      const subscription = subscriptionManager.subscribeToTable(
        sub.table,
        sub.queryKey,
        sub.filter,
        sub.priority || 'medium'
      );
      
      subscriptionsRef.current.push({
        table: sub.table,
        unsubscribe: subscription.unsubscribe
      });
      
      // Invalidate the associated queries
      queryClient.invalidateQueries({ queryKey: Array.isArray(sub.queryKey) ? sub.queryKey : [sub.queryKey] });
    });
    
    setStatus(prev => ({
      ...prev,
      hasStaleSubscriptions: false
    }));
  };

  return {
    ...status,
    resetAllSubscriptions,
    subscriptions: subscriptionsRef.current.map(s => s.table)
  };
}
