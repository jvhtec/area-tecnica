import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PerformanceOptimizedSubscriptionManager } from '@/lib/performance-optimized-subscription-manager';

interface UseOptimizedRealtimeOptions {
  enabled?: boolean;
  priority?: 'high' | 'medium' | 'low';
  dependencies?: any[];
}

interface RealtimeStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * Optimized realtime hook that uses the performance-optimized subscription manager
 */
export function useOptimizedRealtime(
  table: string,
  queryKey: string | string[],
  options: UseOptimizedRealtimeOptions = {}
) {
  const {
    enabled = true,
    priority = 'medium',
    dependencies = []
  } = options;
  
  const queryClient = useQueryClient();
  const subscriptionManager = PerformanceOptimizedSubscriptionManager.getInstance(queryClient);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  
  const [status, setStatus] = useState<RealtimeStatus>({
    isConnected: false,
    isLoading: false,
    error: null,
    retryCount: 0
  });
  
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    setStatus(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Subscribe to table
      subscriptionRef.current = subscriptionManager.subscribeToTable(
        table,
        queryKey,
        priority
      );
      
      setStatus(prev => ({
        ...prev,
        isConnected: true,
        isLoading: false,
        error: null
      }));
      
    } catch (error) {
      console.error(`Error setting up realtime subscription for ${table}:`, error);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: prev.retryCount + 1
      }));
    }
    
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [enabled, table, JSON.stringify(queryKey), priority, ...dependencies]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);
  
  const retry = () => {
    setStatus(prev => ({ ...prev, retryCount: 0 }));
    // Force a re-run of the effect
    setStatus(prev => ({ ...prev, isLoading: true }));
  };
  
  return {
    ...status,
    retry,
    stats: subscriptionManager.getStats()
  };
}

/**
 * Hook to monitor overall subscription manager performance
 */
export function useSubscriptionStats() {
  const queryClient = useQueryClient();
  const subscriptionManager = PerformanceOptimizedSubscriptionManager.getInstance(queryClient);
  const [stats, setStats] = useState(subscriptionManager.getStats());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(subscriptionManager.getStats());
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return stats;
}