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

export const usePerformanceMonitor = () => {
  const diagnosticsEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MATRIX === 'true';
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    queryTime: 0,
    cellRenderCount: 0
  });
  
  const renderStartRef = useRef<number>(0);
  const queryStartRef = useRef<number>(0);
  const cellRenderCountRef = useRef<number>(0);

  const startRenderTimer = useCallback(() => {
    if (!diagnosticsEnabled) {
      return;
    }
    renderStartRef.current = performance.now();
  }, [diagnosticsEnabled]);

  const endRenderTimer = useCallback(() => {
    if (!diagnosticsEnabled) {
      return;
    }
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;
      setMetrics(prev => ({ ...prev, renderTime }));
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
    if (!diagnosticsEnabled) return;
    cellRenderCountRef.current += 1;
    if (cellRenderCountRef.current % 5000 === 0) {
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
