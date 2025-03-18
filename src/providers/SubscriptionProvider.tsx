
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';
import { useToast } from '@/hooks/use-toast';
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
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  connectionStatus: 'disconnected',
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
  refreshSubscriptions: () => {},
  invalidateQueries: () => {},
  lastRefreshTime: 0,
  forceRefresh: () => {}
});

export const useSubscriptionContext = () => useContext(SubscriptionContext);

interface SubscriptionProviderProps {
  children: React.ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SubscriptionContextType>({
    connectionStatus: 'disconnected',
    activeSubscriptions: [],
    subscriptionCount: 0,
    subscriptionsByTable: {},
    refreshSubscriptions: () => {},
    invalidateQueries: () => {},
    lastRefreshTime: Date.now(),
    forceRefresh: () => {}
  });
  const { toast } = useToast();
  
  // Track last connection status to notify on changes
  const lastConnectionStatusRef = React.useRef<string>(state.connectionStatus);
  const tokenManager = TokenManager.getInstance();

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
      tables.forEach(table => {
        manager.unsubscribeFromTable(table, table);
        manager.subscribeToTable(table, table);
      });
      queryClient.invalidateQueries();
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    });
    
    // Define refresh function
    const refreshSubscriptions = () => {
      // Recreate subscriptions by unsubscribing and resubscribing
      const tables = Object.keys(manager.getSubscriptionsByTable());
      tables.forEach(table => {
        manager.unsubscribeFromTable(table, table);
        manager.subscribeToTable(table, table);
      });
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
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
        toast({
          title: 'Real-time subscriptions refreshed',
          description: `${tables.join(', ')} tables refreshed`,
          variant: 'default'
        });
      } else {
        // Refresh all tables
        refreshSubscriptions();
        queryClient.invalidateQueries();
        toast({
          title: 'All real-time subscriptions refreshed',
          description: 'Data has been refreshed',
          variant: 'default'
        });
      }
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    };
    
    // Update state with functions
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      invalidateQueries,
      forceRefresh,
      lastRefreshTime: Date.now()
    }));
    
    // Update state periodically to reflect current subscription status
    const intervalId = setInterval(() => {
      const connectionStatus = manager.getConnectionStatus();
      
      // Notify users of connection status changes
      if (connectionStatus !== lastConnectionStatusRef.current) {
        if (connectionStatus === 'connected' && lastConnectionStatusRef.current !== 'connected') {
          toast({
            title: 'Connection restored',
            description: 'Real-time updates are now active',
            variant: 'default'
          });
        } else if (connectionStatus === 'disconnected' && lastConnectionStatusRef.current === 'connected') {
          toast({
            title: 'Connection lost',
            description: 'Attempting to reconnect...',
            variant: 'destructive'
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
    }, 5000);
    
    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [queryClient, toast]);

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
