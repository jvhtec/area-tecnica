
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionManager } from '@/lib/subscription-manager';
import { toast } from '@/hooks/use-toast';

// Context for providing subscription manager state
interface SubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  connectionStatus: 'disconnected',
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {}
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
    subscriptionsByTable: {}
  });
  
  // Track last connection status to notify on changes
  const lastConnectionStatusRef = React.useRef<string>(state.connectionStatus);

  useEffect(() => {
    // Initialize the subscription manager
    const manager = SubscriptionManager.getInstance(queryClient);
    
    // Setup network status and visibility monitoring
    manager.setupNetworkStatusRefetching();
    manager.setupVisibilityBasedRefetching();
    
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
      
      setState({
        connectionStatus: manager.getConnectionStatus(),
        activeSubscriptions: manager.getActiveSubscriptions(),
        subscriptionCount: manager.getSubscriptionCount(),
        subscriptionsByTable: manager.getSubscriptionsByTable()
      });
    }, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}
