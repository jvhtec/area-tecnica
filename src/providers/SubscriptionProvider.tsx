
import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import { useQueryClient } from "@tanstack/react-query";
import { debounce } from "@/lib/utils";

export interface SubscriptionsByTable {
  [tableName: string]: string[];
}

export type SubscriptionContextType = {
  activeSubscriptions: string[];
  subscriptionCount: number;
  subscriptionsByTable: SubscriptionsByTable;
  refreshSubscriptions: () => void;
  forceSubscribe: (table: string | string[]) => void;
  invalidateQueries: () => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastRefreshTime: number;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  activeSubscriptions: [],
  subscriptionCount: 0,
  subscriptionsByTable: {},
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
  const [subscriptionsByTable, setSubscriptionsByTable] = useState<SubscriptionsByTable>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  
  // Use a memoized instance of the manager to prevent unnecessary re-renders
  const manager = useMemo(() => {
    return UnifiedSubscriptionManager.getInstance(queryClient);
  }, [queryClient]);
  
  // Memoize update function to ensure consistent reference
  const updateSubscriptionState = useCallback(() => {
    try {
      // Get active subscriptions as strings
      const subscriptions = manager.getActiveSubscriptions();
      // Make sure we're working with string arrays
      const subscriptionKeys = subscriptions.map(sub => String(sub));
      
      const subsByTable = manager.getSubscriptionsByTable() || {};
      
      // Convert subscriptions by table to expected format
      const formattedSubsByTable: SubscriptionsByTable = {};
      Object.entries(subsByTable).forEach(([table, subscriptions]) => {
        if (Array.isArray(subscriptions)) {
          formattedSubsByTable[table] = subscriptions.map(sub => 
            typeof sub === 'string' ? sub : String(sub)
          );
        } else {
          formattedSubsByTable[table] = [];
        }
      });
      
      setActiveSubscriptions(subscriptionKeys);
      setSubscriptionsByTable(formattedSubsByTable);
      setConnectionStatus(manager.getConnectionStatus());
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("Error updating subscription state:", error);
    }
  }, [manager]);
  
  // Memoize debounced update function
  const debouncedUpdate = useMemo(() => {
    return debounce(updateSubscriptionState, 1000);
  }, [updateSubscriptionState]);
  
  // Update state with the current subscriptions
  useEffect(() => {
    // Initial state update
    updateSubscriptionState();
    
    // Set up interval for periodic updates (prevents stale UI)
    const intervalId = setInterval(debouncedUpdate, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [updateSubscriptionState, debouncedUpdate]);
  
  // Memorize callback functions to prevent unnecessary re-renders
  const refreshSubscriptions = useCallback(() => {
    console.log("Manually reestablishing subscriptions");
    manager.reestablishSubscriptions();
    setLastRefreshTime(Date.now());
  }, [manager]);
  
  const forceSubscribe = useCallback((table: string | string[]) => {
    console.log(`Manually subscribing to table(s):`, table);
    if (Array.isArray(table)) {
      table.forEach(t => manager.subscribeToTable(t, [t]));
    } else {
      manager.subscribeToTable(table, [table]);
    }
  }, [manager]);
  
  const invalidateQueries = useCallback(() => {
    console.log("Invalidating all queries");
    queryClient.invalidateQueries();
  }, [queryClient]);
  
  const contextValue = useMemo(() => ({
    activeSubscriptions,
    subscriptionCount: activeSubscriptions.length,
    subscriptionsByTable,
    refreshSubscriptions,
    forceSubscribe,
    invalidateQueries,
    connectionStatus,
    lastRefreshTime
  }), [
    activeSubscriptions, 
    subscriptionsByTable,
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
