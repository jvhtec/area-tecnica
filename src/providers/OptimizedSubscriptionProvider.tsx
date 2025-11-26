
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { OptimizedSubscriptionManager } from '@/lib/optimized-subscription-manager';
import { toast } from 'sonner';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

interface OptimizedSubscriptionContextType {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  activeSubscriptions: number;
  subscribedTables: string[];
  refreshSubscriptions: () => void;
  batchSubscribe: (subscriptions: Array<{
    table: string;
    queryKey: string | string[];
    filter?: any;
    priority?: 'high' | 'medium' | 'low';
  }>) => void;
  lastRefreshTime: number;
}

const OptimizedSubscriptionContext = createContext<OptimizedSubscriptionContextType>({
  connectionStatus: 'connecting',
  activeSubscriptions: 0,
  subscribedTables: [],
  refreshSubscriptions: () => {},
  batchSubscribe: () => {},
  lastRefreshTime: 0,
});

export const useOptimizedSubscription = () => useContext(OptimizedSubscriptionContext);

interface OptimizedSubscriptionProviderProps {
  children: React.ReactNode;
}

export function OptimizedSubscriptionProvider({ children }: OptimizedSubscriptionProviderProps) {
  const queryClient = useQueryClient();
  const { userRole } = useOptimizedAuth();
  const isAdmin = userRole === 'admin';

  const [state, setState] = useState<OptimizedSubscriptionContextType>({
    connectionStatus: 'connecting',
    activeSubscriptions: 0,
    subscribedTables: [],
    refreshSubscriptions: () => {},
    batchSubscribe: () => {},
    lastRefreshTime: Date.now(),
  });

  // Initialize the optimized subscription manager
  useEffect(() => {
    const manager = OptimizedSubscriptionManager.getInstance(queryClient);

    // Optimized refresh function
    const refreshSubscriptions = useCallback(() => {
      console.log('Refreshing optimized subscriptions...');
      const status = manager.getStatus();
      setState(prev => ({
        ...prev,
        lastRefreshTime: Date.now(),
        connectionStatus: status.connectionStatus,
        activeSubscriptions: status.activeSubscriptions,
        subscribedTables: status.tables
      }));
      // Only show toasts to admin users
      if (isAdmin) {
        toast.success('Subscriptions refreshed');
      }
    }, [manager, isAdmin]);

    // Batch subscribe function
    const batchSubscribe = useCallback((subscriptions: Array<{
      table: string;
      queryKey: string | string[];
      filter?: any;
      priority?: 'high' | 'medium' | 'low';
    }>) => {
      manager.batchSubscribe(subscriptions);
      
      // Update state
      const status = manager.getStatus();
      setState(prev => ({ 
        ...prev,
        connectionStatus: status.connectionStatus,
        activeSubscriptions: status.activeSubscriptions,
        subscribedTables: status.tables
      }));
    }, [manager]);

    // Update state with functions
    setState(prev => ({
      ...prev,
      refreshSubscriptions,
      batchSubscribe,
    }));

    // Set up core subscriptions for essential tables
    const coreSubscriptions = [
      { table: 'jobs', queryKey: ['jobs'], priority: 'high' as const },
      { table: 'profiles', queryKey: ['profiles'], priority: 'high' as const },
      { table: 'job_assignments', queryKey: ['jobs'], priority: 'medium' as const },
      { table: 'job_documents', queryKey: ['jobs'], priority: 'medium' as const },
    ];

    manager.batchSubscribe(coreSubscriptions);

    // Update state periodically but less frequently
    const statusInterval = setInterval(() => {
      const status = manager.getStatus();
      setState(prev => ({
        ...prev,
        connectionStatus: status.connectionStatus,
        activeSubscriptions: status.activeSubscriptions,
        subscribedTables: status.tables,
      }));
    }, 5000); // Every 5 seconds instead of 2

    return () => {
      clearInterval(statusInterval);
      manager.cleanup();
    };
  }, [queryClient]);

  return (
    <OptimizedSubscriptionContext.Provider value={state}>
      {children}
    </OptimizedSubscriptionContext.Provider>
  );
}
