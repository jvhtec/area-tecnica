
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EmergencySubscriptionManager } from '@/lib/emergency-subscription-manager';
import { toast } from 'sonner';
import { TokenManager } from '@/lib/token-manager';
import { MultiTabCoordinator } from '@/lib/multitab-coordinator';

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
  
  // Track last connection status to notify on changes
  const lastConnectionStatusRef = React.useRef<string>(state.connectionStatus);
  const tokenManager = TokenManager.getInstance();
  const connectionCheckIntervalRef = React.useRef<number | null>(null);
  const [isLeader, setIsLeader] = useState(true);
  const multiTabCoordinator = MultiTabCoordinator.getInstance(queryClient);

  // Listen for tab role changes
  useEffect(() => {
    const handleTabRoleChange = (event: CustomEvent) => {
      setIsLeader(event.detail.isLeader);
    };
    
    window.addEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    
    return () => {
      window.removeEventListener('tab-leader-elected', handleTabRoleChange as EventListener);
    };
  }, []);

  // Initialize the emergency subscription manager (real-time disabled)
  useEffect(() => {
    const manager = EmergencySubscriptionManager.getInstance(queryClient);
    
    // Performance optimization: Only leader handles heavy operations
    
    // Subscribe to token refreshes to update subscriptions
    const unsubscribe = tokenManager.subscribe(() => {
      console.log("Token refreshed, updating subscriptions");
      
      // Force refresh all subscriptions with the optimized manager
      manager.forceRefresh();
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    });
    
    // Define refresh function with performance optimization
    const refreshSubscriptions = () => {
      console.log("Manually refreshing subscriptions...");
      
      manager.forceRefresh();
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
      
      toast.success("Subscriptions refreshed");
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
    
    // Define force refresh function - simplified for performance
    const forceRefresh = (tables?: string[]) => {
      manager.forceRefresh();
      
      if (tables && tables.length > 0) {
        toast.success(`Refreshed ${tables.join(', ')} tables`);
      } else {
        toast.success('All subscriptions refreshed');
      }
      
      setState(prev => ({ ...prev, lastRefreshTime: Date.now() }));
    };
    
    // Define force subscribe function - simplified for performance
    const forceSubscribe = (tables: string[]) => {
      if (!tables || tables.length === 0) return;
      
      console.log(`Ensuring subscriptions for tables: ${tables.join(', ')}`);
      
      // Subscribe to each table with optimized manager
      tables.forEach(table => {
        manager.subscribeToTable(table, table, 'medium');
      });
      
      // Update state with current stats
      const stats = manager.getStats();
      setState(prev => ({ 
        ...prev, 
        subscriptionCount: stats.subscriptionCount,
        activeSubscriptions: [] // Simplified for performance
      }));
    };
    
    // Update state with functions
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      invalidateQueries,
      forceRefresh,
      forceSubscribe,
      lastRefreshTime: Date.now()
    }));
    
    // Set initial connection status - emergency mode
    setState(prev => ({
      ...prev, 
      connectionStatus: 'disconnected' // Always disconnected in emergency mode
    }));
    
    // Clear any existing interval
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    
    // Much longer intervals to reduce database load
    const intervalTime = 30000; // 30 seconds for everyone
    
    connectionCheckIntervalRef.current = window.setInterval(() => {
      const stats = manager.getStats();
      
      // Only show emergency mode notification once
      if (isLeader && !lastConnectionStatusRef.current.includes('emergency')) {
        toast.warning('Emergency Mode Active', {
          description: 'Real-time updates disabled to restore database performance.',
          duration: 10000,
        });
        lastConnectionStatusRef.current = 'emergency-mode';
      }
      
      setState(prev => ({
        ...prev,
        connectionStatus: 'disconnected', // Always disconnected in emergency mode
        subscriptionCount: 0,
        activeSubscriptions: [],
        subscriptionsByTable: {},
      }));
    }, intervalTime);
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
      unsubscribe();
    };
  }, [queryClient, isLeader]);

  // No subscriptions in emergency mode
  useEffect(() => {
    if (isLeader) {
      console.log('Emergency mode: Core subscriptions disabled');
    }
    
    return () => {
      // No cleanup needed in emergency mode
    };
  }, [queryClient, isLeader]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}
