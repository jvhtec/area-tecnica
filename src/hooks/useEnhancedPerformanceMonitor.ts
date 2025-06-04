
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Enhanced performance monitoring hook with better query tracking
 * and automatic cleanup to prevent memory leaks
 */
export const useEnhancedPerformanceMonitor = () => {
  const queryClient = useQueryClient();
  const performanceMetrics = useRef<Map<string, number[]>>(new Map());
  const queryStartTimes = useRef<Map<string, number>>(new Map());
  const alertThresholds = useRef({
    slowQuery: 2000, // 2 seconds
    verySlowQuery: 5000, // 5 seconds
    maxMetricsAge: 3600000 // 1 hour
  });

  useEffect(() => {
    const trackQueryPerformance = (queryKey: string, duration: number) => {
      const metrics = performanceMetrics.current.get(queryKey) || [];
      metrics.push(duration);
      
      // Keep only last 50 measurements per query to prevent memory issues
      if (metrics.length > 50) {
        metrics.shift();
      }
      
      performanceMetrics.current.set(queryKey, metrics);
      
      // Enhanced logging with severity levels
      if (duration > alertThresholds.current.verySlowQuery) {
        console.error(`🚨 Very slow query detected: ${queryKey} took ${duration}ms`);
      } else if (duration > alertThresholds.current.slowQuery) {
        console.warn(`⚠️ Slow query detected: ${queryKey} took ${duration}ms`);
      }
      
      // Calculate and log performance trends
      const average = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
      if (metrics.length >= 5 && average > alertThresholds.current.slowQuery) {
        console.warn(`📊 Consistently slow query: ${queryKey} averages ${average.toFixed(0)}ms over ${metrics.length} calls`);
      }
    };

    // Monitor query lifecycle with proper event handling using correct React Query event types
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const queryKey = JSON.stringify(event.query.queryKey);
      
      if (event.type === 'added') {
        queryStartTimes.current.set(queryKey, Date.now());
      }
      
      if (event.type === 'updated' && event.query.state.fetchStatus === 'idle') {
        const startTime = queryStartTimes.current.get(queryKey);
        if (startTime) {
          const duration = Date.now() - startTime;
          trackQueryPerformance(queryKey, duration);
          queryStartTimes.current.delete(queryKey);
        }
      }
      
      if (event.type === 'removed') {
        queryStartTimes.current.delete(queryKey);
      }
    });

    // Periodic cleanup to prevent memory leaks
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = alertThresholds.current.maxMetricsAge;
      
      // Clean up old start times
      queryStartTimes.current.forEach((startTime, queryKey) => {
        if (now - startTime > maxAge) {
          queryStartTimes.current.delete(queryKey);
        }
      });
      
      // Optionally clean up very old metrics
      if (performanceMetrics.current.size > 100) {
        console.log('🧹 Cleaning up old performance metrics to prevent memory issues');
        // Keep only the most recent 50 query types
        const entries = Array.from(performanceMetrics.current.entries());
        const recentEntries = entries.slice(-50);
        performanceMetrics.current.clear();
        recentEntries.forEach(([key, value]) => {
          performanceMetrics.current.set(key, value);
        });
      }
    }, 300000); // Clean up every 5 minutes

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
    };
  }, [queryClient]);

  const getPerformanceInsights = () => {
    const insights: Array<{
      queryKey: string;
      average: number;
      count: number;
      max: number;
      min: number;
      recommendation: string;
    }> = [];
    
    performanceMetrics.current.forEach((durations, queryKey) => {
      const average = durations.reduce((sum, val) => sum + val, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      
      let recommendation = '✅ Performance is good';
      if (average > alertThresholds.current.verySlowQuery) {
        recommendation = '🚨 Critical: Optimize immediately - consider database indexes or query restructuring';
      } else if (average > alertThresholds.current.slowQuery) {
        recommendation = '⚠️ Consider optimization - add caching or improve query efficiency';
      } else if (durations.length > 100) {
        recommendation = '📈 High usage query - ensure proper caching and monitoring';
      }

      insights.push({
        queryKey,
        average: Math.round(average),
        count: durations.length,
        max,
        min,
        recommendation
      });
    });
    
    return insights.sort((a, b) => b.average - a.average);
  };

  const logPerformanceReport = () => {
    const insights = getPerformanceInsights();
    
    console.group('📊 Enhanced Performance Report');
    console.log(`📈 Total tracked query types: ${performanceMetrics.current.size}`);
    console.log(`⏱️ Active queries being timed: ${queryStartTimes.current.size}`);
    
    if (insights.length > 0) {
      console.log('\n🔝 Top performance concerns:');
      insights.slice(0, 10).forEach((insight, index) => {
        const icon = index < 3 ? '🔴' : index < 6 ? '🟡' : '🟢';
        console.log(`${icon} ${insight.queryKey}:`);
        console.log(`   Average: ${insight.average}ms | Calls: ${insight.count} | Range: ${insight.min}-${insight.max}ms`);
        console.log(`   ${insight.recommendation}`);
      });
    }
    
    console.groupEnd();
  };

  const clearMetrics = () => {
    performanceMetrics.current.clear();
    queryStartTimes.current.clear();
    console.log('🧹 Performance metrics cleared');
  };

  return {
    getPerformanceInsights,
    logPerformanceReport,
    clearMetrics
  };
};
