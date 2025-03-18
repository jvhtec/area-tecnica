
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
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  connectionStatus: 'disconnected',
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
  refreshSubscriptions: () => {},
  invalidateQueries: () => {}
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
    invalidateQueries: () => {}
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
      manager.reestablishSubscriptions();
      queryClient.invalidateQueries();
    });
    
    // Define refresh function
    const refreshSubscriptions = () => {
      manager.reestablishSubscriptions();
    };
    
    // Define invalidate function with optional specific query key
    const invalidateQueries = (queryKey?: string | string[]) => {
      if (queryKey) {
        const key = Array.isArray(queryKey) ? queryKey : [queryKey];
        queryClient.invalidateQueries({ queryKey: key });
      } else {
        queryClient.invalidateQueries();
      }
    };
    
    // Update state with functions
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      invalidateQueries
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
        refreshSubscriptions,
        invalidateQueries
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
