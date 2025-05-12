
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";

interface SubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  subscriptionCount: number;
  subscriptionsByTable: Record<string, string[]>;
  refreshSubscriptions: () => void;
  invalidateQueries: () => void;
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
  
  // Update context values periodically
  useEffect(() => {
    const updateStatus = () => {
      setConnectionStatus(manager.getConnectionStatus());
      setSubscriptionCount(manager.getSubscriptionCount());
      setSubscriptionsByTable(manager.getSubscriptionsByTable() || {});
    };
    
    // Update immediately and then every 5 seconds
    updateStatus();
    const interval = setInterval(updateStatus, 5000);
    
    return () => clearInterval(interval);
  }, [manager]);
  
  // Helper function to refresh all subscriptions
  const refreshSubscriptions = () => {
    manager.reestablishSubscriptions();
  };
  
  // Helper function to invalidate all queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries();
  };
  
  const contextValue: SubscriptionContextType = {
    connectionStatus,
    subscriptionCount,
    subscriptionsByTable,
    refreshSubscriptions,
    invalidateQueries,
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
