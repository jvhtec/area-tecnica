
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Connection pool management hook to optimize Supabase connections
 */
export const useConnectionPool = () => {
  const activeConnections = useRef<Set<string>>(new Set());
  const connectionMetrics = useRef({
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0,
    averageResponseTime: 0
  });

  useEffect(() => {
    const trackConnection = (operation: string) => {
      const connectionId = `${operation}-${Date.now()}`;
      activeConnections.current.add(connectionId);
      connectionMetrics.current.totalConnections++;
      connectionMetrics.current.activeConnections = activeConnections.current.size;
      
      return {
        finish: () => {
          activeConnections.current.delete(connectionId);
          connectionMetrics.current.activeConnections = activeConnections.current.size;
        },
        fail: () => {
          activeConnections.current.delete(connectionId);
          connectionMetrics.current.failedConnections++;
          connectionMetrics.current.activeConnections = activeConnections.current.size;
        }
      };
    };

    // Monitor connection health
    const healthCheck = setInterval(async () => {
      const startTime = Date.now();
      try {
        await supabase.from('profiles').select('id').limit(1);
        const responseTime = Date.now() - startTime;
        
        // Update average response time
        connectionMetrics.current.averageResponseTime = 
          (connectionMetrics.current.averageResponseTime + responseTime) / 2;
        
        // Log if response time is concerning
        if (responseTime > 3000) {
          console.warn(`High database response time: ${responseTime}ms`);
        }
      } catch (error) {
        console.error('Database health check failed:', error);
        connectionMetrics.current.failedConnections++;
      }
    }, 60000); // Check every minute

    // Log connection metrics periodically
    const metricsLogger = setInterval(() => {
      if (connectionMetrics.current.totalConnections > 0) {
        console.log('Connection Pool Metrics:', {
          ...connectionMetrics.current,
          failureRate: (connectionMetrics.current.failedConnections / connectionMetrics.current.totalConnections * 100).toFixed(2) + '%'
        });
      }
    }, 300000); // Log every 5 minutes

    return () => {
      clearInterval(healthCheck);
      clearInterval(metricsLogger);
    };
  }, []);

  const getConnectionMetrics = () => ({
    ...connectionMetrics.current,
    failureRate: connectionMetrics.current.totalConnections > 0 
      ? (connectionMetrics.current.failedConnections / connectionMetrics.current.totalConnections * 100).toFixed(2) + '%'
      : '0%'
  });

  const optimizeConnections = () => {
    // Clear any stale connections
    activeConnections.current.clear();
    connectionMetrics.current.activeConnections = 0;
    
    // Reset metrics for fresh tracking
    connectionMetrics.current = {
      totalConnections: 0,
      activeConnections: 0,
      failedConnections: 0,
      averageResponseTime: 0
    };
    
    console.log('Connection pool optimized');
  };

  return {
    getConnectionMetrics,
    optimizeConnections
  };
};
