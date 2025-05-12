
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
    return queryClient ? UnifiedSubscriptionManager.getInstance(queryClient) : null;
  }, [queryClient]);
  
  // Memoize update function to ensure consistent reference
  const updateSubscriptionState = useCallback(() => {
    if (!manager) {
      console.warn("Subscription manager is not available");
      return;
    }

    try {
      // Get active subscriptions with proper null/undefined checks
      const subscriptions = manager.getActiveSubscriptions ? manager.getActiveSubscriptions() : [];
      // Make sure we're working with string arrays and handle null/undefined
      const subscriptionKeys = Array.isArray(subscriptions) ? subscriptions.map(sub => String(sub || '')) : [];
      
      const subsByTable = manager.getSubscriptionsByTable ? manager.getSubscriptionsByTable() : {};
      
      // Convert subscriptions by table to expected format, with safety checks
      const formattedSubsByTable: SubscriptionsByTable = {};
      if (subsByTable && typeof subsByTable === 'object') {
        Object.entries(subsByTable).forEach(([table, subscriptions]) => {
          if (Array.isArray(subscriptions)) {
            formattedSubsByTable[table] = subscriptions
              .filter(sub => sub !== null && sub !== undefined)
              .map(sub => typeof sub === 'string' ? sub : String(sub));
          } else {
            formattedSubsByTable[table] = [];
          }
        });
      }
      
      setActiveSubscriptions(subscriptionKeys);
      setSubscriptionsByTable(formattedSubsByTable);
      setConnectionStatus(manager.getConnectionStatus ? manager.getConnectionStatus() : 'disconnected');
      setLastRefreshTime(Date.now());
    } catch (error) {
      console.error("Error updating subscription state:", error);
      // Set default values in case of error
      setActiveSubscriptions([]);
      setSubscriptionsByTable({});
    }
  }, [manager]);
  
  // Memoize debounced update function
  const debouncedUpdate = useMemo(() => {
    return updateSubscriptionState ? debounce(updateSubscriptionState, 1000) : () => {};
  }, [updateSubscriptionState]);
  
  // Update state with the current subscriptions
  useEffect(() => {
    if (!manager) return;
    
    // Initial state update
    updateSubscriptionState();
    
    // Set up interval for periodic updates (prevents stale UI)
    const intervalId = setInterval(debouncedUpdate, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [updateSubscriptionState, debouncedUpdate, manager]);
  
  // Memorize callback functions to prevent unnecessary re-renders
  const refreshSubscriptions = useCallback(() => {
    console.log("Manually reestablishing subscriptions");
    if (manager && typeof manager.reestablishSubscriptions === 'function') {
      manager.reestablishSubscriptions();
    }
    setLastRefreshTime(Date.now());
  }, [manager]);
  
  const forceSubscribe = useCallback((table: string | string[]) => {
    console.log(`Manually subscribing to table(s):`, table);
    if (!manager) return;
    
    if (Array.isArray(table)) {
      table.forEach(t => {
        if (t) manager.subscribeToTable(t, [t]);
      });
    } else if (table) {
      manager.subscribeToTable(table, [table]);
    }
  }, [manager]);
  
  const invalidateQueries = useCallback(() => {
    console.log("Invalidating all queries");
    if (queryClient) {
      queryClient.invalidateQueries();
    }
  }, [queryClient]);
  
  const contextValue = useMemo(() => ({
    activeSubscriptions,
    subscriptionCount: activeSubscriptions ? activeSubscriptions.length : 0,
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
