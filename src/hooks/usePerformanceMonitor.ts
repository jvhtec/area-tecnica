import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  queryTime: number;
  cellRenderCount: number;
  memoryUsage?: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    queryTime: 0,
    cellRenderCount: 0
  });
  
  const renderStartRef = useRef<number>(0);
  const queryStartRef = useRef<number>(0);
  const cellRenderCountRef = useRef<number>(0);

  const startRenderTimer = () => {
    renderStartRef.current = performance.now();
  };

  const endRenderTimer = () => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      setMetrics(prev => ({ ...prev, renderTime }));
      console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
    }
  };

  const startQueryTimer = () => {
    queryStartRef.current = performance.now();
  };

  const endQueryTimer = () => {
    if (queryStartRef.current) {
      const queryTime = performance.now() - queryStartRef.current;
      setMetrics(prev => ({ ...prev, queryTime }));
      console.log(`${componentName} query time: ${queryTime.toFixed(2)}ms`);
    }
  };

  const incrementCellRender = () => {
    cellRenderCountRef.current += 1;
    if (cellRenderCountRef.current % 100 === 0) {
      setMetrics(prev => ({ ...prev, cellRenderCount: cellRenderCountRef.current }));
      console.log(`${componentName} cells rendered: ${cellRenderCountRef.current}`);
    }
  };

  const measureMemoryUsage = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      setMetrics(prev => ({ ...prev, memoryUsage }));
      console.log(`${componentName} memory usage: ${memoryUsage.toFixed(2)}MB`);
    }
  };

  // Auto-measure memory every 5 seconds
  useEffect(() => {
    const interval = setInterval(measureMemoryUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    startRenderTimer,
    endRenderTimer,
    startQueryTimer,
    endQueryTimer,
    incrementCellRender,
    measureMemoryUsage
  };
};