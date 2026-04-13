import { useCallback, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  queryTime: number;
  cellRenderCount: number;
  memoryUsage?: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
  };
}

export const usePerformanceMonitor = (componentName: string) => {
  const diagnosticsEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MATRIX === 'true';
  void componentName;
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    queryTime: 0,
    cellRenderCount: 0
  });
  
  const renderStartRef = useRef<number>(0);
  const queryStartRef = useRef<number>(0);
  const cellRenderCountRef = useRef<number>(0);

  const startRenderTimer = useCallback(() => {
    renderStartRef.current = performance.now();
  }, []);

  const endRenderTimer = useCallback(() => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      if (diagnosticsEnabled) {
        setMetrics(prev => ({ ...prev, renderTime }));
      }
    }
  }, [diagnosticsEnabled]);

  const startQueryTimer = useCallback(() => {
    queryStartRef.current = performance.now();
  }, []);

  const endQueryTimer = useCallback(() => {
    if (queryStartRef.current) {
      const queryTime = performance.now() - queryStartRef.current;
      if (diagnosticsEnabled) {
        setMetrics(prev => ({ ...prev, queryTime }));
      }
    }
  }, [diagnosticsEnabled]);

  const incrementCellRender = useCallback(() => {
    cellRenderCountRef.current += 1;
    if (diagnosticsEnabled && cellRenderCountRef.current % 5000 === 0) {
      setMetrics(prev => ({ ...prev, cellRenderCount: cellRenderCountRef.current }));
    }
  }, [diagnosticsEnabled]);

  const measureMemoryUsage = useCallback(() => {
    const performanceWithMemory = performance as PerformanceWithMemory;
    if (diagnosticsEnabled && performanceWithMemory.memory) {
      const memory = performanceWithMemory.memory;
      const memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
      setMetrics(prev => ({ ...prev, memoryUsage }));
    }
  }, [diagnosticsEnabled]);

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
