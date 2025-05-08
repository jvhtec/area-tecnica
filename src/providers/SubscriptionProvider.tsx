
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { connectionManager } from '@/lib/connection-manager';
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
  
  // Initialize managers
  useEffect(() => {
    // Initialize connection manager
    connectionManager.initialize(queryClient);
    
    // Get subscription manager instance
    const manager = UnifiedSubscriptionManager.getInstance(queryClient);
    
    // Setup subscription monitoring
    const connectionCheckIntervalRef = window.setInterval(() => {
      const connectionStatus = connectionManager.getConnectionStatus().state;
      
      setState(prev => ({
        ...prev,
        connectionStatus,
        activeSubscriptions: manager.getActiveSubscriptions(),
        subscriptionCount: manager.getSubscriptionCount(),
        subscriptionsByTable: manager.getSubscriptionsByTable(),
        lastRefreshTime: connectionManager.getConnectionStatus().lastHeartbeatResponse
      }));
    }, 2000);
    
    // Define refresh function
    const refreshSubscriptions = () => {
      connectionManager.forceRefresh();
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
      // Get subscription manager
      const manager = UnifiedSubscriptionManager.getInstance(queryClient);
      
      if (tables && tables.length > 0) {
        // Refresh specific tables
        manager.forceRefreshSubscriptions(tables);
        
        // Invalidate related queries
        tables.forEach(table => {
          queryClient.invalidateQueries({ queryKey: [table] });
        });
      } else {
        // Refresh all tables by forcing connection validation
        connectionManager.validateConnections(true);
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
      forceSubscribe
    }));
    
    // Clean up interval
    return () => {
      if (connectionCheckIntervalRef) {
        clearInterval(connectionCheckIntervalRef);
      }
      // Clean up connection manager
      connectionManager.cleanup();
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
