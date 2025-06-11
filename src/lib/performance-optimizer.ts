
/**
 * Performance optimization utilities for the application
 */

import { QueryClient } from '@tanstack/react-query';

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private queryMetrics: Map<string, { count: number; totalTime: number; lastRun: number }> = new Map();

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * Track query performance and identify optimization opportunities
   */
  trackQuery(queryKey: string, duration: number) {
    const existing = this.queryMetrics.get(queryKey);
    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.lastRun = Date.now();
    } else {
      this.queryMetrics.set(queryKey, {
        count: 1,
        totalTime: duration,
        lastRun: Date.now()
      });
    }

    // Log slow queries
    if (duration > 2000) {
      console.warn(`⚠️ Slow query detected: ${queryKey} took ${duration}ms`);
    }
  }

  /**
   * Get performance insights and recommendations
   */
  getPerformanceInsights() {
    const insights: Array<{
      queryKey: string;
      averageTime: number;
      count: number;
      recommendation: string;
    }> = [];

    this.queryMetrics.forEach((metrics, queryKey) => {
      const averageTime = metrics.totalTime / metrics.count;
      let recommendation = 'Performance is good';

      if (averageTime > 3000) {
        recommendation = 'Consider adding database indexes or optimizing query';
      } else if (averageTime > 1500) {
        recommendation = 'Monitor for further optimization opportunities';
      } else if (metrics.count > 100) {
        recommendation = 'Frequently used query - ensure proper caching';
      }

      insights.push({
        queryKey,
        averageTime,
        count: metrics.count,
        recommendation
      });
    });

    return insights.sort((a, b) => b.averageTime - a.averageTime);
  }

  /**
   * Optimize React Query client configuration
   */
  optimizeQueryClient(queryClient: QueryClient) {
    // Set optimal defaults
    queryClient.setDefaultOptions({
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 2,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true
      },
      mutations: {
        retry: 1,
        retryDelay: 1000
      }
    });

    console.log('✅ Query client optimized with performance defaults');
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  clearOldMetrics() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    this.queryMetrics.forEach((metrics, queryKey) => {
      if (metrics.lastRun < oneHourAgo) {
        this.queryMetrics.delete(queryKey);
      }
    });
  }

  /**
   * Log comprehensive performance report
   */
  logPerformanceReport() {
    const insights = this.getPerformanceInsights();
    
    console.group('📊 Performance Report');
    console.log(`Total tracked queries: ${this.queryMetrics.size}`);
    console.log('Top slow queries:');
    
    insights.slice(0, 10).forEach(insight => {
      console.log(`  ${insight.queryKey}: ${insight.averageTime.toFixed(0)}ms avg (${insight.count} calls) - ${insight.recommendation}`);
    });
    
    console.groupEnd();
  }
}

export const performanceOptimizer = PerformanceOptimizer.getInstance();
