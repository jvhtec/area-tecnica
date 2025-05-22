
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedSubscriptionManager } from '@/lib/unified-subscription-manager';
import { ensureRealtimeConnection, checkNetworkConnection } from '@/lib/enhanced-supabase-client';

interface SubscriptionContextType {
  lastRefreshTime: number;
  connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  subscriptionsByTable: Record<string, string[]>;
  isNetworkAvailable: boolean;
  forceRefresh: (tables?: string[]) => void;
  forceSubscribe: (tables: string[]) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  lastRefreshTime: Date.now(),
  connectionStatus: 'CONNECTING',
  subscriptionsByTable: {},
  isNetworkAvailable: true,
  forceRefresh: () => {},
  forceSubscribe: () => {},
});

export const useSubscriptionContext = () => useContext(SubscriptionContext);

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider = ({ children }: SubscriptionProviderProps) => {
  const queryClient = useQueryClient();
  const manager = UnifiedSubscriptionManager.getInstance(queryClient);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [subscriptionsByTable, setSubscriptionsByTable] = useState<Record<string, string[]>>({});
  const [isNetworkAvailable, setIsNetworkAvailable] = useState<boolean>(true);
  
  // Check network status initially and set up polling
  useEffect(() => {
    const checkNetwork = async () => {
      const isAvailable = await checkNetworkConnection();
      setIsNetworkAvailable(isAvailable);
    };
    
    checkNetwork();
    
    // Poll network status every 30 seconds
    const intervalId = setInterval(checkNetwork, 30000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Ensure realtime connection on mount
  useEffect(() => {
    ensureRealtimeConnection().then(connected => {
      setConnectionStatus(connected ? 'CONNECTED' : 'CONNECTING');
    });
  }, []);
  
  // Update subscription table stats periodically
  useEffect(() => {
    const updateStats = () => {
      const tables = manager.getSubscriptionsByTable();
      setSubscriptionsByTable(tables);
    };
    
    // Initial update
    updateStats();
    
    // Update every 3 seconds
    const intervalId = setInterval(updateStats, 3000);
    
    return () => clearInterval(intervalId);
  }, [manager]);
  
  // Force refresh subscriptions for specified tables
  const forceRefresh = useCallback((tables?: string[]) => {
    if (tables && tables.length > 0) {
      manager.forceRefreshSubscriptions(tables);
    } else {
      manager.reestablishSubscriptions();
    }
    
    setLastRefreshTime(Date.now());
    
    // Also invalidate React Query cache
    queryClient.invalidateQueries();
  }, [manager, queryClient]);
  
  // Force subscribe to specific tables
  const forceSubscribe = useCallback((tables: string[]) => {
    tables.forEach(table => {
      manager.subscribeToTable(table, table, undefined, 'high');
    });
    
    // Invalidate queries for these tables
    queryClient.invalidateQueries({ queryKey: tables });
    setLastRefreshTime(Date.now());
  }, [manager, queryClient]);
  
  const value = {
    lastRefreshTime,
    connectionStatus,
    subscriptionsByTable,
    isNetworkAvailable,
    forceRefresh,
    forceSubscribe
  };
  
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
