
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { toast } from 'sonner';
import { TokenManager } from '@/lib/token-manager';

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
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    
    // Setup network status and visibility monitoring
    manager.setupNetworkStatusRefetching();
    manager.setupVisibilityBasedRefetching();
    
    // Subscribe to token refreshes to update subscriptions
    const unsubscribe = tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      
      // Get current subscriptions by table
      const tables = Object.keys(manager.getSubscriptionsByTable());
      
      // Force refresh all subscriptions
      manager.forceRefreshSubscriptions(tables);
      queryClient.invalidateQueries();
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    });
    
    // Define refresh function
    const refreshSubscriptions = () => {
      console.log("Manually refreshing subscriptions...");
      
      // Get current subscriptions by table
      const tables = Object.keys(manager.getSubscriptionsByTable());
      
      // Force refresh all subscriptions
      manager.forceRefreshSubscriptions(tables);
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
      
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
        manager.forceRefreshSubscriptions(tables);
        
        // Invalidate related queries
        tables.forEach(table => {
          queryClient.invalidateQueries({ queryKey: [table] });
        });
        
        toast.success(`Refreshed ${tables.join(', ')} tables`);
      } else {
        // Refresh all tables
        const allTables = Object.keys(manager.getSubscriptionsByTable());
        manager.forceRefreshSubscriptions(allTables);
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
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    
    // Set up core tables that most pages need
    manager.subscribeToTable('profiles', 'profiles', undefined, 'high');
    manager.subscribeToTable('jobs', 'jobs', undefined, 'high');
    
    return () => {
      // Don't unsubscribe from core tables as they are needed throughout the app
    };
  }, [queryClient]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}
