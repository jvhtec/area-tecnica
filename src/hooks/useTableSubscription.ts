import { useState, useEffect, useRef } from 'react';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { useQueryClient } from '@tanstack/react-query';

type SubscriptionOptions = {
  filter?: {
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    schema?: string,
    filter?: string
  },
  priority?: 'high' | 'medium' | 'low',
  onSubscriptionError?: () => void,
  onSubscriptionReconnect?: () => void
};

/**
 * Hook for subscribing to Supabase table changes with enhanced performance and reliability
 * 
 * @param table The table name to subscribe to
 * @param queryKey The query key to invalidate on changes (string or string[])
 * @param options Additional subscription options
 * @returns Subscription status information
 */
export function useTableSubscription(
  table: string,
  queryKey: string | string[],
  options?: SubscriptionOptions
) {
  const queryClient = useQueryClient();
  const subscriptionManager = UnifiedSubscriptionManager.getInstance(queryClient);
  const [isStale, setIsStale] = useState(false);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Keep track of subscription keys for cleanup
  const subscriptionKeyRef = useRef<string | null>(null);
  const tableInfoRef = useRef({ table, queryKey });
  
  // Update refs when inputs change
  useEffect(() => {
    tableInfoRef.current = { table, queryKey };
  }, [table, queryKey]);
  
  // Set up subscription
  useEffect(() => {
    if (!table || !queryKey) {
      return;
    }
    
    try {
      // Create a normalized key for the subscription
      const normalizedQueryKey = Array.isArray(queryKey) 
        ? JSON.stringify(queryKey) 
        : queryKey;
        
      const subscriptionKey = `${table}::${normalizedQueryKey}`;
      subscriptionKeyRef.current = subscriptionKey;
      
      console.log(`Setting up subscription for table ${table} with key ${normalizedQueryKey}`);
      
      // Subscribe to the table
      const subscription = subscriptionManager.subscribeToTable(
        table, 
        queryKey, 
        options?.filter, 
        options?.priority || 'medium'
      );
      
      // Update subscription status
      const checkSubscriptionStatus = () => {
        const status = subscriptionManager.getSubscriptionStatus(table, queryKey);
        setIsSubscribed(status.isConnected);
        setLastActivity(status.lastActivity);
        
        // Check if data is stale (no activity for over 5 minutes)
        const now = Date.now();
        setIsStale(now - status.lastActivity > 5 * 60 * 1000);
      };
      
      // Check initial status
      checkSubscriptionStatus();
      
      // Set up interval to check status
      const statusInterval = setInterval(checkSubscriptionStatus, 30000);
      
      // Set up connection status listener
      const handleConnectionChange = () => {
        const connectionStatus = subscriptionManager.getConnectionStatus();
        
        if (connectionStatus === 'disconnected') {
          setIsSubscribed(false);
          if (options?.onSubscriptionError) {
            options.onSubscriptionError();
          }
        } else if (connectionStatus === 'connected') {
          checkSubscriptionStatus();
          if (options?.onSubscriptionReconnect) {
            options.onSubscriptionReconnect();
          }
        }
      };
      
      // Listen for connection status changes
      window.addEventListener('supabase-connection-change', handleConnectionChange);
      
      // Clean up subscription
      return () => {
        clearInterval(statusInterval);
        window.removeEventListener('supabase-connection-change', handleConnectionChange);
        
        // No need to unsubscribe as the subscription manager handles cleanup
      };
    } catch (error) {
      console.error(`Error setting up subscription for ${table}:`, error);
      setIsSubscribed(false);
      if (options?.onSubscriptionError) {
        options.onSubscriptionError();
      }
      return () => {};
    }
  }, [table, queryKey, queryClient, options]);
  
  // Provide a function to manually refresh the subscription
  const refreshSubscription = () => {
    try {
      if (subscriptionKeyRef.current) {
        subscriptionManager.forceRefreshSubscriptions([tableInfoRef.current.table]);
        setLastActivity(Date.now());
        setIsStale(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error refreshing subscription for ${tableInfoRef.current.table}:`, error);
      return false;
    }
  };
  
  return {
    isSubscribed,
    isStale,
    lastActivity,
    refreshSubscription
  };
}
