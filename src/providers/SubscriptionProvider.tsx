
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

interface SubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  lastRefreshTime: number;
  activeSubscriptions: Array<any>;
  refreshSubscriptions: () => void;
  invalidateQueries: () => void;
  forceSubscribe: (tables: string[]) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Provider component for subscription management
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [manager] = useState(() => UnifiedSubscriptionManager.getInstance(queryClient));
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>(
    manager.getConnectionStatus()
  );
  const [subscriptionCount, setSubscriptionCount] = useState(manager.getSubscriptionCount());
  const [subscriptionsByTable, setSubscriptionsByTable] = useState<Record<string, string[]>>(
    manager.getSubscriptionsByTable() || {}
  );
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [activeSubscriptions, setActiveSubscriptions] = useState<Array<any>>(
    manager.getActiveSubscriptions?.() || []
  );
  
  // Update context values periodically
  useEffect(() => {
    const updateStatus = () => {
      setConnectionStatus(manager.getConnectionStatus());
      setSubscriptionCount(manager.getSubscriptionCount());
      setSubscriptionsByTable(manager.getSubscriptionsByTable() || {});
      setActiveSubscriptions(manager.getActiveSubscriptions?.() || []);
    };
    
    // Update immediately and then every 5 seconds
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    
    return () => clearInterval(interval);
  }, [manager]);
  
  // Helper function to refresh all subscriptions
  const refreshSubscriptions = () => {
    manager.reestablishSubscriptions();
    setLastRefreshTime(Date.now());
  };
  
  // Helper function to invalidate all queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries();
  };
  
  // Helper function to force subscribe to specific tables
  const forceSubscribe = (tables: string[]) => {
    console.log(`Force subscribing to tables: ${tables.join(', ')}`);
    tables.forEach(table => {
      // Basic implementation - in a real app, you might want more sophisticated logic
      manager.subscribeToTable(table, [table]);
    });
    setLastRefreshTime(Date.now());
  };
  
  const contextValue: SubscriptionContextType = {
    connectionStatus,
    subscriptionCount,
    subscriptionsByTable,
    lastRefreshTime,
    activeSubscriptions,
    refreshSubscriptions,
    invalidateQueries,
    forceSubscribe,
  };
  
  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook to access subscription context
 */
export function useSubscriptionContext(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptionContext must be used within a SubscriptionProvider");
  }
  return context;
}
