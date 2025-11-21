/**
 * Performance Monitoring System
 *
 * Comprehensive performance tracking for mobile optimization:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Component render times
 * - Network request timing
 * - Memory usage
 * - Frame rate monitoring
 */

// ============================================
// TYPES
// ============================================

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface RenderMetric {
  componentName: string;
  renderTime: number;
  timestamp: number;
  isSlowRender: boolean;
}

interface NetworkMetric {
  url: string;
  method: string;
  duration: number;
  status: number;
  size?: number;
  timestamp: number;
}

interface MemoryMetric {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

interface FrameMetric {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  timestamp: number;
}

// ============================================
// PERFORMANCE MONITOR CLASS
// ============================================

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private renderMetrics: RenderMetric[] = [];
  private networkMetrics: NetworkMetric[] = [];
  private memoryMetrics: MemoryMetric[] = [];
  private frameMetrics: FrameMetric[] = [];
  private enabled: boolean = true;
  private maxMetrics: number = 1000;
  private slowRenderThreshold: number = 16; // ms (1 frame at 60fps)
  private slowNetworkThreshold: number = 3000; // ms

  // Frame rate monitoring
  private frameCount: number = 0;
  private lastFrameTime: number = 0;
  private frameRateInterval: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;

  private constructor() {
    this.initializeCoreWebVitals();
    this.initializeMemoryMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // ============================================
  // CORE WEB VITALS
  // ============================================

  private initializeCoreWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint (LCP)
    this.observeLCP();

    // First Input Delay (FID)
    this.observeFID();

    // Cumulative Layout Shift (CLS)
    this.observeCLS();

    // First Contentful Paint (FCP)
    this.observeFCP();

    // Time to First Byte (TTFB)
    this.observeTTFB();
  }

  private observeLCP(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];

        this.recordMetric('LCP', lastEntry.startTime, {
          element: (lastEntry as PerformanceEntry & { element?: Element }).element?.tagName,
        });
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }
  }

  private observeFID(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry) => {
          const fidEntry = entry as PerformanceEventTiming;
          this.recordMetric('FID', fidEntry.processingStart - fidEntry.startTime, {
            eventType: fidEntry.name,
          });
        });
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // FID not supported
    }
  }

  private observeCLS(): void {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry) => {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput && layoutShift.value) {
            clsValue += layoutShift.value;
            this.recordMetric('CLS', clsValue);
          }
        });
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS not supported
    }
  }

  private observeFCP(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('FCP', entry.startTime);
          }
        });
      });

      observer.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // FCP not supported
    }
  }

  private observeTTFB(): void {
    if (typeof window === 'undefined') return;

    // Use Navigation Timing API
    window.addEventListener('load', () => {
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (timing) {
        this.recordMetric('TTFB', timing.responseStart - timing.requestStart);
      }
    });
  }

  // ============================================
  // MEMORY MONITORING
  // ============================================

  private initializeMemoryMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Check every 30 seconds
    setInterval(() => {
      this.recordMemory();
    }, 30000);
  }

  private recordMemory(): void {
    const memory = (performance as Performance & { memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    } }).memory;

    if (memory) {
      const metric: MemoryMetric = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        timestamp: Date.now(),
      };

      this.memoryMetrics.push(metric);
      this.trimArray(this.memoryMetrics);

      // Warn if memory usage is high
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (usagePercent > 80) {
        console.warn(`[Perf] High memory usage: ${usagePercent.toFixed(1)}%`);
      }
    }
  }

  // ============================================
  // FRAME RATE MONITORING
  // ============================================

  startFrameRateMonitoring(): void {
    if (this.rafId !== null) return;

    let lastTime = performance.now();
    let frames = 0;
    let droppedFrames = 0;

    const loop = (currentTime: number) => {
      frames++;
      const delta = currentTime - lastTime;

      // Check for dropped frames (> 1.5 frame time)
      if (delta > 25) {
        droppedFrames += Math.floor(delta / 16.67) - 1;
      }

      lastTime = currentTime;
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);

    // Record FPS every second
    this.frameRateInterval = setInterval(() => {
      const metric: FrameMetric = {
        fps: frames,
        frameTime: frames > 0 ? 1000 / frames : 0,
        droppedFrames,
        timestamp: Date.now(),
      };

      this.frameMetrics.push(metric);
      this.trimArray(this.frameMetrics);

      // Warn if FPS is low
      if (frames < 30) {
        console.warn(`[Perf] Low FPS: ${frames}`);
      }

      frames = 0;
      droppedFrames = 0;
    }, 1000);
  }

  stopFrameRateMonitoring(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.frameRateInterval !== null) {
      clearInterval(this.frameRateInterval);
      this.frameRateInterval = null;
    }
  }

  // ============================================
  // COMPONENT RENDER TRACKING
  // ============================================

  measureRender(componentName: string): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;
      const isSlowRender = renderTime > this.slowRenderThreshold;

      const metric: RenderMetric = {
        componentName,
        renderTime,
        timestamp: Date.now(),
        isSlowRender,
      };

      this.renderMetrics.push(metric);
      this.trimArray(this.renderMetrics);

      if (isSlowRender) {
        console.warn(`[Perf] Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
    };
  }

  // ============================================
  // NETWORK TRACKING
  // ============================================

  trackNetworkRequest(url: string, method: string): (status: number, size?: number) => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();

    return (status: number, size?: number) => {
      const duration = performance.now() - startTime;

      const metric: NetworkMetric = {
        url,
        method,
        duration,
        status,
        size,
        timestamp: Date.now(),
      };

      this.networkMetrics.push(metric);
      this.trimArray(this.networkMetrics);

      if (duration > this.slowNetworkThreshold) {
        console.warn(`[Perf] Slow network request: ${method} ${url} took ${duration.toFixed(0)}ms`);
      }
    };
  }

  // ============================================
  // GENERIC METRICS
  // ============================================

  recordMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);
    this.trimArray(this.metrics);
  }

  mark(name: string): void {
    performance.mark(name);
  }

  measure(name: string, startMark: string, endMark?: string): void {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }

      const entries = performance.getEntriesByName(name, 'measure');
      if (entries.length > 0) {
        this.recordMetric(name, entries[entries.length - 1].duration);
      }
    } catch (e) {
      // Measurement failed
    }
  }

  // ============================================
  // REPORTS
  // ============================================

  getReport(): {
    webVitals: PerformanceMetric[];
    renderMetrics: RenderMetric[];
    networkMetrics: NetworkMetric[];
    memoryMetrics: MemoryMetric[];
    frameMetrics: FrameMetric[];
    summary: {
      avgRenderTime: number;
      slowRenders: number;
      avgNetworkTime: number;
      slowRequests: number;
      currentFPS: number;
      memoryUsagePercent: number;
    };
  } {
    const webVitals = this.metrics.filter((m) =>
      ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'].includes(m.name)
    );

    // Calculate averages
    const renderTimes = this.renderMetrics.map((m) => m.renderTime);
    const networkTimes = this.networkMetrics.map((m) => m.duration);

    const avgRenderTime =
      renderTimes.length > 0
        ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
        : 0;

    const avgNetworkTime =
      networkTimes.length > 0
        ? networkTimes.reduce((a, b) => a + b, 0) / networkTimes.length
        : 0;

    const slowRenders = this.renderMetrics.filter((m) => m.isSlowRender).length;
    const slowRequests = this.networkMetrics.filter(
      (m) => m.duration > this.slowNetworkThreshold
    ).length;

    const latestFrame = this.frameMetrics[this.frameMetrics.length - 1];
    const latestMemory = this.memoryMetrics[this.memoryMetrics.length - 1];

    return {
      webVitals,
      renderMetrics: this.renderMetrics.slice(-100),
      networkMetrics: this.networkMetrics.slice(-100),
      memoryMetrics: this.memoryMetrics.slice(-100),
      frameMetrics: this.frameMetrics.slice(-60),
      summary: {
        avgRenderTime,
        slowRenders,
        avgNetworkTime,
        slowRequests,
        currentFPS: latestFrame?.fps || 0,
        memoryUsagePercent: latestMemory
          ? (latestMemory.usedJSHeapSize / latestMemory.jsHeapSizeLimit) * 100
          : 0,
      },
    };
  }

  getWebVitalsSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    const vitals = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'];

    vitals.forEach((vital) => {
      const metrics = this.metrics.filter((m) => m.name === vital);
      if (metrics.length > 0) {
        summary[vital] = metrics[metrics.length - 1].value;
      }
    });

    return summary;
  }

  // ============================================
  // UTILITIES
  // ============================================

  private trimArray<T>(arr: T[]): void {
    if (arr.length > this.maxMetrics) {
      arr.splice(0, arr.length - this.maxMetrics);
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  clear(): void {
    this.metrics = [];
    this.renderMetrics = [];
    this.networkMetrics = [];
    this.memoryMetrics = [];
    this.frameMetrics = [];
  }

  // Log report to console
  logReport(): void {
    const report = this.getReport();
    console.group('[Performance Report]');
    console.log('Web Vitals:', this.getWebVitalsSummary());
    console.log('Summary:', report.summary);
    console.log('Recent slow renders:', this.renderMetrics.filter((m) => m.isSlowRender).slice(-10));
    console.log('Recent slow requests:', this.networkMetrics.filter((m) => m.duration > this.slowNetworkThreshold).slice(-10));
    console.groupEnd();
  }
}

// Export singleton
export const performanceMonitor = PerformanceMonitor.getInstance();

// ============================================
// REACT HOOKS
// ============================================

import { useEffect, useRef } from 'react';

/**
 * Hook to measure component render time
 */
export function useRenderPerformance(componentName: string): void {
  const measureEnd = useRef<(() => void) | null>(null);

  // Start measurement
  measureEnd.current = performanceMonitor.measureRender(componentName);

  // End measurement after render
  useEffect(() => {
    measureEnd.current?.();
  });
}

/**
 * Hook to track component lifecycle performance
 */
export function useComponentPerformance(componentName: string): void {
  useEffect(() => {
    performanceMonitor.mark(`${componentName}-mount`);

    return () => {
      performanceMonitor.measure(`${componentName}-lifetime`, `${componentName}-mount`);
    };
  }, [componentName]);
}

/**
 * Hook to enable frame rate monitoring while component is mounted
 */
export function useFrameRateMonitoring(): void {
  useEffect(() => {
    performanceMonitor.startFrameRateMonitoring();
    return () => performanceMonitor.stopFrameRateMonitoring();
  }, []);
}

// ============================================
// PERFORMANCE DECORATOR
// ============================================

/**
 * Higher-order component to track render performance
 */
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const TrackedComponent: React.FC<P> = (props) => {
    useRenderPerformance(displayName);
    return <WrappedComponent {...props} />;
  };

  TrackedComponent.displayName = `withPerformanceTracking(${displayName})`;

  return TrackedComponent;
}

export default performanceMonitor;
