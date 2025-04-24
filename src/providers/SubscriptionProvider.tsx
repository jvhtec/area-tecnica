
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';
import { TokenManager } from '@/lib/token-manager';
import { toast } from 'sonner';

// Context for providing subscription manager state
interface SubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  refreshSubscriptions: () => void;
  invalidateQueries: (queryKey?: string | string[]) => void;
  lastRefreshTime: number;
  forceRefresh: (tables?: string[]) => void;
  forceSubscribe: (tables: string[]) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  connectionStatus: 'connecting',
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
  refreshSubscriptions: () => {},
  invalidateQueries: () => {},
  lastRefreshTime: 0,
  forceRefresh: () => {},
  forceSubscribe: () => {}
});

export const useSubscriptionContext = () => useContext(SubscriptionContext);

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubscriptionContextType>({
    connectionStatus: 'connecting',
    activeSubscriptions: [],
    subscriptionCount: 0,
    subscriptionsByTable: {},
    refreshSubscriptions: () => {},
    invalidateQueries: () => {},
    lastRefreshTime: Date.now(),
    forceRefresh: () => {},
    forceSubscribe: () => {}
  });
  
  // Track last connection status to notify on changes
  const lastConnectionStatusRef = React.useRef<string>(state.connectionStatus);
  const tokenManager = TokenManager.getInstance();
  const connectionCheckIntervalRef = React.useRef<number | null>(null);

  // Initialize the subscription manager
  useEffect(() => {
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Setup network status and visibility monitoring
    manager.setupNetworkStatusRefetching();
    manager.setupVisibilityBasedRefetching();
    
    // Subscribe to token refreshes to update subscriptions
    const unsubscribe = tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      // Recreate subscriptions by unsubscribing and resubscribing
      const tables = Object.keys(manager.getSubscriptionsByTable());
      
      // Only attempt to recreate subscriptions if we have active subscriptions
      if (tables.length > 0) {
        console.log(`Recreating ${tables.length} subscriptions after token refresh`);
        
        tables.forEach(table => {
          manager.unsubscribeFromTable(table, table);
          manager.subscribeToTable(table, table);
        });
        
        queryClient.invalidateQueries();
        setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
        
        toast.success('Connection refreshed after token update');
      }
    });
    
    // Define refresh function
    const refreshSubscriptions = () => {
      console.log("Manually refreshing subscriptions...");
      // Recreate subscriptions by unsubscribing and resubscribing
      const tables = Object.keys(manager.getSubscriptionsByTable());
      
      if (tables.length === 0) {
        toast.info('No active subscriptions to refresh');
        return;
      }
      
      tables.forEach(table => {
        manager.unsubscribeFromTable(table, table);
        manager.subscribeToTable(table, table);
      });
      
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
      queryClient.invalidateQueries();
      
      // Show toast notification
      toast.success("Subscriptions refreshed");
    };
    
    // Define invalidate function with optional specific query key
    const invalidateQueries = (queryKey?: string | string[]) => {
      if (queryKey) {
        const key = Array.isArray(queryKey) ? queryKey : [queryKey];
        queryClient.invalidateQueries({ queryKey: key });
      } else {
        queryClient.invalidateQueries();
      }
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    };
    
    // Define force refresh function for specific tables
    const forceRefresh = (tables?: string[]) => {
      if (tables && tables.length > 0) {
        // Refresh specific tables
        tables.forEach(table => {
          // Unsubscribe and resubscribe
          manager.unsubscribeFromTable(table, table);
          manager.subscribeToTable(table, table);
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: [table] });
        });
        toast.success(`Refreshed ${tables.join(', ')} tables`);
      } else {
        // Refresh all tables
        refreshSubscriptions();
        queryClient.invalidateQueries();
        toast.success('All subscriptions refreshed');
      }
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    };
    
    // Define force subscribe function for specific tables
    const forceSubscribe = (tables: string[]) => {
      if (!tables || tables.length === 0) return;
      
      console.log(`Ensuring subscriptions for tables: ${tables.join(', ')}`);
      
      // Subscribe to each table, ensuring they're active
      tables.forEach(table => {
        if (!manager.getSubscriptionsByTable()[table]?.length) {
          manager.subscribeToTable(table, table);
        }
      });
      
      // Update state to reflect new subscriptions
      setState(prev => ({ 
        ...prev, 
        subscriptionsByTable: manager.getSubscriptionsByTable(),
        subscriptionCount: manager.getSubscriptionCount(),
        activeSubscriptions: manager.getActiveSubscriptions()
      }));
    };
    
    // Update state with functions
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      invalidateQueries,
      forceRefresh,
      forceSubscribe,
      lastRefreshTime: Date.now()
    }));
    
    // Set initial connection status from manager
    setState(prev => ({
      ...prev, 
      connectionStatus: manager.getConnectionStatus()
    }));
    
    // Clear any existing interval
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    
    // Update state periodically to reflect current subscription status
    connectionCheckIntervalRef.current = window.setInterval(() => {
      const connectionStatus = manager.getConnectionStatus();
      
      // Notify users of connection status changes
      if (connectionStatus !== lastConnectionStatusRef.current) {
        if (connectionStatus === 'connected' && lastConnectionStatusRef.current !== 'connected') {
          toast.success('Connection restored', {
            description: 'Real-time updates are now active'
          });
        } else if (connectionStatus === 'disconnected' && lastConnectionStatusRef.current === 'connected') {
          toast.error('Connection lost', {
            description: 'Attempting to reconnect...'
          });
        }
        
        lastConnectionStatusRef.current = connectionStatus;
      }
      
      setState(prev => ({
        ...prev,
        connectionStatus: manager.getConnectionStatus(),
        activeSubscriptions: manager.getActiveSubscriptions(),
        subscriptionCount: manager.getSubscriptionCount(),
        subscriptionsByTable: manager.getSubscriptionsByTable(),
      }));
    }, 2000); // More frequent updates (every 2 seconds)
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
      unsubscribe();
    };
  }, [queryClient]);

  // Setup core tables subscription
  useEffect(() => {
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Set up core tables that most pages need
    manager.subscribeToTable('profiles', 'profiles');
    manager.subscribeToTable('jobs', 'jobs');
    
    return () => {
      manager.unsubscribeFromTable('profiles', 'profiles');
      manager.unsubscribeFromTable('jobs', 'jobs');
    };
  }, [queryClient]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}
