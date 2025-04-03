
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedSubscriptionManager } from '@/lib/enhanced-subscription-manager';
import { TokenManager } from '@/lib/token-manager';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { toast } from 'sonner';

// Context for providing connection status state
interface ConnectionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  activeSubscriptions: string[];
  subscriptionCount: number;
  refreshSubscriptions: () => void;
  forceRefresh: (tables?: string[]) => Promise<void>;
  ensureSubscription: (table: string) => void;
  resetConnection: () => void;
  isRefreshing: boolean;
  lastActivity: number | null;
}

const ConnectionContext = createContext<ConnectionContextType>({
  connectionStatus: 'connecting',
  activeSubscriptions: [],
  subscriptionCount: 0,
  refreshSubscriptions: () => {},
  forceRefresh: async () => {},
  ensureSubscription: () => {},
  resetConnection: () => {},
  isRefreshing: false,
  lastActivity: null,
});

export const useConnection = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: React.ReactNode;
  coreTables?: string[];
}

export function ConnectionProvider({ 
  children, 
  coreTables = ['profiles', 'jobs', 'job_assignments', 'job_departments'] 
}: ConnectionProviderProps) {
  const queryClient = useQueryClient();
  const { refreshSession } = useAuthSession();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastActivity, setLastActivity] = useState<number | null>(null);
  
  // Get instances
  const manager = EnhancedSubscriptionManager.getInstance(queryClient);
  const tokenManager = TokenManager.getInstance();
  
  // Connection state
  const [state, setState] = useState({
    connectionStatus: manager.getConnectionStatus(),
    activeSubscriptions: [] as string[],
    subscriptionCount: 0,
  });
  
  // Track last connection status to notify on changes
  const lastConnectionStatusRef = React.useRef<string>(state.connectionStatus);
  const connectionCheckIntervalRef = React.useRef<number | null>(null);

  // Handle token refreshes
  useEffect(() => {
    // Subscribe to token refreshes to update subscriptions
    const unsubscribe = tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      refreshAll();
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Function to refresh all subscriptions
  const refreshAll = () => {
    // Recreate all subscriptions
    const subscriptions = manager.getAllSubscriptionStatuses();
    Object.keys(subscriptions).forEach(key => {
      const [table, queryKey] = key.split('::');
      manager.unsubscribeFromTable(key);
      manager.subscribeToTable(table, queryKey);
    });
    
    // Invalidate all queries
    queryClient.invalidateQueries();
    
    // Refresh session
    refreshSession();
    
    // Update state
    updateState();
  };
  
  // Function to update internal state
  const updateState = () => {
    setState({
      connectionStatus: manager.getConnectionStatus(),
      activeSubscriptions: Object.keys(manager.getAllSubscriptionStatuses()),
      subscriptionCount: Object.keys(manager.getAllSubscriptionStatuses()).length,
    });
  };
  
  // Set up core subscriptions
  useEffect(() => {
    coreTables.forEach(table => {
      manager.subscribeToTable(table, table);
    });
    
    updateState();
    
    return () => {
      coreTables.forEach(table => {
        manager.unsubscribeFromTable(`${table}::${table}`);
      });
    };
  }, [coreTables]);
  
  // Setup connection status monitoring
  useEffect(() => {
    // Clear any existing interval
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    
    // Set up an interval to check connection status
    connectionCheckIntervalRef.current = window.setInterval(() => {
      const connectionStatus = manager.getConnectionStatus();
      
      // Get most recent activity timestamp
      let mostRecentActivity = 0;
      const statuses = manager.getAllSubscriptionStatuses();
      
      Object.values(statuses).forEach(status => {
        if (status.lastActivity > mostRecentActivity) {
          mostRecentActivity = status.lastActivity;
        }
      });
      
      if (mostRecentActivity > 0) {
        setLastActivity(mostRecentActivity);
      }
      
      // Notify users of connection status changes
      if (connectionStatus !== lastConnectionStatusRef.current) {
        if (connectionStatus === 'connected' && lastConnectionStatusRef.current !== 'connected') {
          toast.success('Connection restored', {
            description: 'Real-time updates are now active'
          });
        } else if (connectionStatus !== 'connected' && lastConnectionStatusRef.current === 'connected') {
          toast.error('Connection lost', {
            description: 'Attempting to reconnect...'
          });
        }
        
        lastConnectionStatusRef.current = connectionStatus;
      }
      
      updateState();
    }, 5000); // Check every 5 seconds
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
    };
  }, []);
  
  // Regularly check for stale subscriptions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const statuses = manager.getAllSubscriptionStatuses();
      
      // Check if any subscriptions are stale (no activity for 10 minutes)
      let hasStaleSubscription = false;
      Object.values(statuses).forEach(status => {
        if (now - status.lastActivity > 10 * 60 * 1000) { // 10 minutes
          hasStaleSubscription = true;
        }
      });
      
      if (hasStaleSubscription && state.connectionStatus === 'connected') {
        console.log('Detected stale subscriptions, refreshing...');
        refreshAll();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [state.connectionStatus]);

  // Function to ensure a specific table is subscribed
  const ensureSubscription = (table: string) => {
    const status = manager.getSubscriptionStatus(table, table);
    if (!status.isConnected) {
      manager.subscribeToTable(table, table);
      updateState();
    }
  };
  
  // Function to refresh subscriptions
  const refreshSubscriptions = () => {
    refreshAll();
  };
  
  // Function to force refresh specific tables
  const forceRefresh = async (tables?: string[]) => {
    setIsRefreshing(true);
    try {
      if (tables && tables.length > 0) {
        // Refresh specific tables
        tables.forEach(table => {
          manager.unsubscribeFromTable(`${table}::${table}`);
          manager.subscribeToTable(table, table);
          queryClient.invalidateQueries({ queryKey: [table] });
        });
        toast.success(`Data refreshed successfully`);
      } else {
        refreshAll();
        toast.success('All data refreshed');
      }
      updateState();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Function to completely reset the connection
  const resetConnection = () => {
    manager.resetAllSubscriptions();
    queryClient.invalidateQueries();
    refreshSession();
    toast.success('Connection reset successfully');
    updateState();
  };
  
  return (
    <ConnectionContext.Provider value={{
      ...state,
      refreshSubscriptions,
      forceRefresh,
      ensureSubscription,
      resetConnection,
      isRefreshing,
      lastActivity,
    }}>
      {children}
    </ConnectionContext.Provider>
  );
}
