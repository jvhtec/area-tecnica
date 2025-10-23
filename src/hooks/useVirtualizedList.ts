import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';

interface UseVirtualizedListOptions {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
}

/**
 * Lightweight virtualization hook for vertical lists.
 * Useful for mobile lists where we want smooth scrolling with large datasets.
 */
export function useVirtualizedList({ itemCount, itemHeight, overscan = 6 }: UseVirtualizedListOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const visibleRange = useMemo(() => {
    if (containerHeight === 0) {
      return { start: 0, end: Math.min(itemCount, overscan) };
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { start, end };
  }, [scrollTop, containerHeight, itemHeight, itemCount, overscan]);

  const totalHeight = itemCount * itemHeight;

  return {
    containerRef,
    handleScroll,
    visibleRange,
    totalHeight,
  };
}
