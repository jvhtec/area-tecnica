import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Performance monitoring hook to track query performance and optimize accordingly
 */
export const usePerformanceMonitor = () => {
  const queryClient = useQueryClient();
  const performanceMetrics = useRef<Map<string, number[]>>(new Map());

  useEffect(() => {
    const trackQueryPerformance = (queryKey: string, duration: number) => {
      const metrics = performanceMetrics.current.get(queryKey) || [];
      metrics.push(duration);
      
      // Keep only last 10 measurements
      if (metrics.length > 10) {
        metrics.shift();
      }
      
      performanceMetrics.current.set(queryKey, metrics);
      
      // Log slow queries (> 2 seconds)
      if (duration > 2000) {
        console.warn(`Slow query detected: ${queryKey} took ${duration}ms`);
      }
      
      // Calculate average for pattern detection
      const average = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
      if (average > 1500) {
        console.warn(`Consistently slow query: ${queryKey} averages ${average.toFixed(0)}ms`);
      }
    };

    // Monitor React Query cache using the observer pattern
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'observerAdded') {
        const startTime = Date.now();
        const queryKey = JSON.stringify(event.query.queryKey);
        
        // Track query state changes to detect completion
        const unsubscribeQuery = event.query.subscribe((query) => {
          // Check if query just completed (either success or error)
          if ((query.state.status === 'success' || query.state.status === 'error') && 
              query.state.fetchStatus === 'idle') {
            const duration = Date.now() - startTime;
            trackQueryPerformance(queryKey, duration);
            
            // Unsubscribe from this specific query to avoid memory leaks
            unsubscribeQuery();
          }
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const getPerformanceMetrics = () => {
    const metrics: Record<string, { average: number; count: number; max: number }> = {};
    
    performanceMetrics.current.forEach((durations, queryKey) => {
      metrics[queryKey] = {
        average: durations.reduce((sum, val) => sum + val, 0) / durations.length,
        count: durations.length,
        max: Math.max(...durations)
      };
    });
    
    return metrics;
  };

  const logPerformanceReport = () => {
    const metrics = getPerformanceMetrics();
    console.table(metrics);
  };

  return {
    getPerformanceMetrics,
    logPerformanceReport
  };
};
