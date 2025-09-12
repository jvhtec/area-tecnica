
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PerformanceOptimizedSubscriptionManager } from '@/lib/performance-optimized-subscription-manager';
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
  forceSubscribe: (tables: Array<{ table: string; queryKey: string | string[]; priority?: 'high' | 'medium' | 'low' }>) => void;
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
  const lastStatsRef = React.useRef<{ status: 'connected' | 'disconnected' | 'connecting'; count: number }>({ status: 'connecting', count: 0 });
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

  // Initialize the performance-optimized subscription manager
  useEffect(() => {
    const manager = PerformanceOptimizedSubscriptionManager.getInstance(queryClient);
    
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
    const forceSubscribe = (tables: Array<{ table: string; queryKey: string | string[]; priority?: 'high' | 'medium' | 'low' }>) => {
      if (!tables || tables.length === 0) return;
      const names = tables.map(t => t.table).join(', ');
      console.log(`Ensuring subscriptions for tables: ${names}`);
      // Subscribe to each table with correct invalidation key
      tables.forEach(({ table, queryKey, priority }) => {
        manager.subscribeToTable(table, queryKey, priority ?? 'medium');
      });
      
      // Update state with current stats
      const stats = manager.getStats();
      setState(prev => ({ 
        ...prev, 
        subscriptionCount: stats.subscriptionCount,
        activeSubscriptions: [] // Simplified for performance
      }));
    };
    
    // Update state with functions and initial connection status in a single update
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      invalidateQueries,
      forceRefresh,
      forceSubscribe,
      lastRefreshTime: Date.now(),
      connectionStatus: 'connecting',
    }));
    
    // Clear any existing interval
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    
    // Update state periodically to reflect current subscription status
    // Reduce frequency for followers to save resources
    const intervalTime = isLeader ? 2000 : 5000; // 2s for leader, 5s for followers
    
    connectionCheckIntervalRef.current = window.setInterval(() => {
      const stats = manager.getStats();
      
      // Only notify users of critical issues if we're the leader
      if (isLeader && stats.circuitBreakerOpen && !lastConnectionStatusRef.current.includes('circuit')) {
        toast.error('Database connection issues detected', {
          description: 'Performance may be degraded. We\'re working to resolve this.',
          duration: 8000,
        });
        lastConnectionStatusRef.current = 'circuit-open';
      } else if (isLeader && !stats.circuitBreakerOpen && lastConnectionStatusRef.current.includes('circuit')) {
        toast.success('Database performance restored', {
          description: 'All systems are operating normally.'
        });
        lastConnectionStatusRef.current = 'connected';
      }
      
      const nextStatus: 'connected' | 'disconnected' = stats.circuitBreakerOpen ? 'disconnected' : 'connected';
      const nextCount = stats.subscriptionCount;
      // Only update state if something actually changed to avoid render loops
      if (lastStatsRef.current.status !== nextStatus || lastStatsRef.current.count !== nextCount) {
        lastStatsRef.current = { status: nextStatus, count: nextCount };
        setState(prev => ({
          ...prev,
          connectionStatus: nextStatus,
          subscriptionCount: nextCount,
          activeSubscriptions: [], // Simplified for performance
          subscriptionsByTable: {}, // Simplified for performance
        }));
      }
    }, intervalTime);
    
    return () => {
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
      }
      unsubscribe();
    };
  }, [queryClient, isLeader]);

  // Setup core tables subscription with performance optimization
  useEffect(() => {
    if (isLeader) {
      const manager = PerformanceOptimizedSubscriptionManager.getInstance(queryClient);
      
      // Set up only essential core tables with high priority
      manager.subscribeToTable('profiles', 'profiles', 'high');
      manager.subscribeToTable('jobs', 'jobs', 'high');
    }
    
    return () => {
      // Cleanup handled by the manager
    };
  }, [queryClient, isLeader]);

  return (
    <SubscriptionContext.Provider value={state}>
      {children}
    </SubscriptionContext.Provider>
  );
}
