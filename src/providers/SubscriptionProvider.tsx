
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useQueryClient } from "@tanstack/react-query";
import { debounce } from "@/lib/utils";

export type SubscriptionContextType = {
  activeSubscriptions: string[];
  subscriptionCount: number;
  refreshSubscriptions: () => void;
  forceSubscribe: (table: string) => void;
  invalidateQueries: () => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastRefreshTime: number;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  activeSubscriptions: [],
  subscriptionCount: 0,
  refreshSubscriptions: () => {},
  forceSubscribe: () => {},
  invalidateQueries: () => {},
  connectionStatus: 'disconnected',
  lastRefreshTime: Date.now(),
});

export const useSubscriptionContext = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [activeSubscriptions, setActiveSubscriptions] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  
  // Use a memoized instance of the manager to prevent unnecessary re-renders
  const manager = useMemo(() => {
    const instance = UnifiedSubscriptionManager.getInstance(queryClient);
    return instance;
  }, [queryClient]);
  
  // Update state with the current subscriptions
  useEffect(() => {
    // Initial state update
    const updateSubscriptionState = () => {
      const subs = manager.getActiveSubscriptions();
      setActiveSubscriptions(subs);
      setConnectionStatus(manager.getConnectionStatus());
      setLastRefreshTime(manager.getLastRefreshTime());
    };
    
    // Set up interval to periodically update the state
    updateSubscriptionState();
    
    // Create debounced version to prevent excessive updates
    const debouncedUpdate = debounce(updateSubscriptionState, 1000);
    
    // Subscribe to subscription changes
    const unsubscribe = manager.onSubscriptionChange(() => {
      debouncedUpdate();
    });
    
    // Set up interval for periodic updates (prevents stale UI)
    const intervalId = setInterval(debouncedUpdate, 10000);
    
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, [manager]);
  
  // Memorize callback functions to prevent unnecessary re-renders
  const refreshSubscriptions = useMemo(() => {
    return () => {
      console.log("Manually reestablishing subscriptions");
      manager.reestablishSubscriptions();
      setLastRefreshTime(Date.now());
    };
  }, [manager]);
  
  const forceSubscribe = useMemo(() => {
    return (table: string) => {
      console.log(`Manually subscribing to table: ${table}`);
      manager.subscribeToTable(table, [table]);
    };
  }, [manager]);
  
  const invalidateQueries = useMemo(() => {
    return () => {
      console.log("Invalidating all queries");
      queryClient.invalidateQueries();
    };
  }, [queryClient]);
  
  const contextValue = useMemo(() => ({
    activeSubscriptions,
    subscriptionCount: activeSubscriptions.length,
    refreshSubscriptions,
    forceSubscribe,
    invalidateQueries,
    connectionStatus,
    lastRefreshTime
  }), [
    activeSubscriptions, 
    refreshSubscriptions, 
    forceSubscribe, 
    invalidateQueries, 
    connectionStatus,
    lastRefreshTime
  ]);
  
  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};
