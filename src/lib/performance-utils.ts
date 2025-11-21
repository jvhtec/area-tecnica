/**
 * Performance Utilities for Mobile Optimization
 *
 * This module provides utilities for optimizing React performance,
 * especially on mobile devices and Android.
 */

import { useCallback, useRef, useMemo, useEffect, useState } from 'react';

// ============================================
// SHALLOW COMPARISON UTILITIES
// ============================================

/**
 * Fast shallow equality check for objects
 * Much faster than JSON.stringify comparison
 */
export function shallowEqual<T extends Record<string, unknown>>(objA: T, objB: T): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false;
  }

  return true;
}

/**
 * Fast array shallow equality check
 */
export function arrayShallowEqual<T>(arrA: T[], arrB: T[]): boolean {
  if (arrA === arrB) return true;
  if (!arrA || !arrB) return false;
  if (arrA.length !== arrB.length) return false;

  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }

  return true;
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce function that cancels previous calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T & { cancel: () => void };

  debouncedFn.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };

  return debouncedFn;
}

/**
 * Throttle function for rate-limiting calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): T {
  let inThrottle = false;

  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  }) as T;
}

// ============================================
// HOOKS FOR PERFORMANCE
// ============================================

/**
 * useDebounce hook - Debounces a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useThrottle hook - Throttles a value
 */
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => clearTimeout(handler);
  }, [value, limit]);

  return throttledValue;
}

/**
 * useDebouncedCallback - Returns a debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(debounce(callback, delay), [...deps, delay]);
}

/**
 * useStableCallback - Returns a stable callback reference
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args) => callbackRef.current(...args)) as T, []);
}

/**
 * usePrevious - Returns the previous value of a variable
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// ============================================
// MEMOIZATION HELPERS
// ============================================

/**
 * Create a memoized selector with shallow comparison
 */
export function createSelector<TInput, TOutput>(
  selector: (input: TInput) => TOutput
): (input: TInput) => TOutput {
  let lastInput: TInput | undefined;
  let lastOutput: TOutput | undefined;

  return (input: TInput): TOutput => {
    if (lastInput !== undefined && shallowEqual(input as Record<string, unknown>, lastInput as Record<string, unknown>)) {
      return lastOutput as TOutput;
    }
    lastInput = input;
    lastOutput = selector(input);
    return lastOutput;
  };
}

/**
 * Memoize a function with LRU cache
 */
export function memoizeWithCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  maxSize: number = 100
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>();
  const keys: string[] = [];

  return (...args: TArgs): TResult => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key) as TResult;
    }

    const result = fn(...args);

    if (keys.length >= maxSize) {
      const oldestKey = keys.shift();
      if (oldestKey) cache.delete(oldestKey);
    }

    cache.set(key, result);
    keys.push(key);

    return result;
  };
}

// ============================================
// INTERSECTION OBSERVER FOR LAZY LOADING
// ============================================

/**
 * useIntersectionObserver - Observes element visibility
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, { threshold: 0.1, ...options });

    observer.observe(element);
    return () => observer.disconnect();
  }, [options.threshold, options.root, options.rootMargin]);

  return [ref, isVisible];
}

/**
 * useLazyLoad - Lazy loads content when visible
 */
export function useLazyLoad(): [React.RefObject<HTMLDivElement>, boolean] {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [ref, isVisible] = useIntersectionObserver({ threshold: 0.1 });

  useEffect(() => {
    if (isVisible && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded]);

  return [ref, hasLoaded];
}

// ============================================
// REQUEST ANIMATION FRAME UTILITIES
// ============================================

/**
 * useRequestAnimationFrame - Runs callback in RAF
 */
export function useRequestAnimationFrame(
  callback: (deltaTime: number) => void,
  isActive: boolean = true
): void {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!isActive) return;

    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);
}

/**
 * scheduleIdleCallback - Schedules work during idle time
 */
export function scheduleIdleCallback(
  callback: () => void,
  options?: IdleRequestOptions
): number {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback for browsers without requestIdleCallback
  return window.setTimeout(callback, 1) as unknown as number;
}

/**
 * cancelIdleCallback - Cancels scheduled idle callback
 */
export function cancelIdleCallbackPolyfill(id: number): void {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

// ============================================
// VIRTUALIZATION HELPERS
// ============================================

/**
 * Calculate visible items for virtualization
 */
export function getVisibleRange(
  containerHeight: number,
  scrollTop: number,
  itemHeight: number,
  itemCount: number,
  overscan: number = 3
): { start: number; end: number } {
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(itemCount, start + visibleCount + 2 * overscan);

  return { start, end };
}

/**
 * useVirtualScroll - Basic virtual scrolling hook
 */
export function useVirtualScroll(
  itemCount: number,
  itemHeight: number,
  containerRef: React.RefObject<HTMLElement>,
  overscan: number = 3
): {
  visibleRange: { start: number; end: number };
  totalHeight: number;
  offsetY: number;
} {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    const handleScroll = throttle(() => {
      setScrollTop(container.scrollTop);
    }, 16); // ~60fps

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef]);

  const visibleRange = useMemo(
    () => getVisibleRange(containerHeight, scrollTop, itemHeight, itemCount, overscan),
    [containerHeight, scrollTop, itemHeight, itemCount, overscan]
  );

  return {
    visibleRange,
    totalHeight: itemCount * itemHeight,
    offsetY: visibleRange.start * itemHeight,
  };
}

// ============================================
// IMAGE LOADING UTILITIES
// ============================================

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * useImagePreload - Preloads images
 */
export function useImagePreload(sources: string[]): boolean {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (sources.length === 0) {
      setLoaded(true);
      return;
    }

    Promise.all(sources.map(preloadImage))
      .then(() => setLoaded(true))
      .catch(() => setLoaded(true)); // Still mark as loaded on error
  }, [sources.join(',')]);

  return loaded;
}

// ============================================
// NETWORK STATUS
// ============================================

/**
 * useNetworkStatus - Tracks network connection status
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  effectiveType: string | null;
  saveData: boolean;
} {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    effectiveType: (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection?.effectiveType || null,
    saveData: (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData || false,
  });

  useEffect(() => {
    const updateOnlineStatus = () => {
      setStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
    };

    const updateConnectionStatus = () => {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
      if (connection) {
        setStatus(prev => ({
          ...prev,
          effectiveType: connection.effectiveType || null,
          saveData: connection.saveData || false,
        }));
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (connection) {
      connection.addEventListener('change', updateConnectionStatus);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  return status;
}

// ============================================
// PERFORMANCE METRICS
// ============================================

/**
 * measureRenderTime - Measures component render time
 */
export function measureRenderTime(componentName: string): () => void {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (duration > 16) { // More than one frame (60fps)
      console.warn(`[Perf] ${componentName} render took ${duration.toFixed(2)}ms`);
    }
  };
}

/**
 * useRenderCount - Counts component renders (dev only)
 */
export function useRenderCount(componentName: string): void {
  const renderCount = useRef(0);
  renderCount.current += 1;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Render] ${componentName}: ${renderCount.current}`);
  }
}

// ============================================
// BATCH STATE UPDATES
// ============================================

/**
 * Batch multiple state updates together
 */
export function batchUpdates(callback: () => void): void {
  // React 18 automatically batches, but this provides explicit control
  callback();
}

/**
 * useBatchedState - Batches multiple state updates
 */
export function useBatchedState<T extends Record<string, unknown>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState(initialState);

  const batchedSetState = useCallback((updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return [state, batchedSetState];
}
