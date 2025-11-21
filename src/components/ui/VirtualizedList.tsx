/**
 * VirtualizedList Component
 *
 * High-performance list rendering for mobile devices.
 * Only renders items that are visible in the viewport.
 */

import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
  forwardRef,
} from 'react';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Height of each item in pixels (or function for dynamic heights) */
  itemHeight: number | ((index: number, item: T) => number);
  /** Render function for each item */
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  /** Optional key extractor */
  keyExtractor?: (item: T, index: number) => string;
  /** Container height (defaults to 100%) */
  height?: number | string;
  /** Number of items to render outside viewport */
  overscan?: number;
  /** Optional className for container */
  className?: string;
  /** Optional className for inner container */
  innerClassName?: string;
  /** Callback when scroll position changes */
  onScroll?: (scrollTop: number) => void;
  /** Callback when visible range changes */
  onVisibleRangeChange?: (start: number, end: number) => void;
  /** Optional empty state component */
  emptyComponent?: React.ReactNode;
  /** Optional loading state */
  isLoading?: boolean;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Scroll to index on mount */
  initialScrollIndex?: number;
}

interface VirtualizedGridProps<T> {
  items: T[];
  itemHeight: number;
  itemWidth: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  height?: number | string;
  overscan?: number;
  className?: string;
  gap?: number;
}

// ============================================
// VIRTUALIZED LIST
// ============================================

function VirtualizedListInner<T>(
  {
    items,
    itemHeight,
    renderItem,
    keyExtractor = (_item, index) => String(index),
    height = '100%',
    overscan = 5,
    className,
    innerClassName,
    onScroll,
    onVisibleRangeChange,
    emptyComponent,
    isLoading,
    loadingComponent,
    initialScrollIndex,
  }: VirtualizedListProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Merge refs
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Calculate item offsets for variable height items
  const { itemOffsets, totalHeight } = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;

    for (let i = 0; i < items.length; i++) {
      offsets.push(total);
      const h = typeof itemHeight === 'function' ? itemHeight(i, items[i]) : itemHeight;
      total += h;
    }

    return { itemOffsets: offsets, totalHeight: total };
  }, [items, itemHeight]);

  // Get visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (containerHeight === 0) {
      return { startIndex: 0, endIndex: Math.min(10, items.length) };
    }

    // Binary search for start index
    let start = 0;
    let end = items.length - 1;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      const midOffset = itemOffsets[mid];
      const midHeight = typeof itemHeight === 'function'
        ? itemHeight(mid, items[mid])
        : itemHeight;

      if (midOffset + midHeight < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    const startIdx = Math.max(0, start - overscan);

    // Find end index
    let endIdx = startIdx;
    let currentOffset = itemOffsets[startIdx] || 0;
    while (endIdx < items.length && currentOffset < scrollTop + containerHeight) {
      const h = typeof itemHeight === 'function'
        ? itemHeight(endIdx, items[endIdx])
        : itemHeight;
      currentOffset += h;
      endIdx++;
    }

    return {
      startIndex: startIdx,
      endIndex: Math.min(items.length, endIdx + overscan),
    };
  }, [scrollTop, containerHeight, items, itemOffsets, itemHeight, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Notify visible range change
  useEffect(() => {
    onVisibleRangeChange?.(startIndex, endIndex);
  }, [startIndex, endIndex, onVisibleRangeChange]);

  // Initial scroll
  useEffect(() => {
    if (initialScrollIndex !== undefined && containerRef.current && itemOffsets[initialScrollIndex]) {
      containerRef.current.scrollTop = itemOffsets[initialScrollIndex];
    }
  }, [initialScrollIndex, itemOffsets]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        {loadingComponent || <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />}
      </div>
    );
  }

  // Handle empty state
  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        {emptyComponent || <span className="text-muted-foreground">No items</span>}
      </div>
    );
  }

  // Render visible items
  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    const item = items[i];
    const h = typeof itemHeight === 'function' ? itemHeight(i, item) : itemHeight;
    const style: React.CSSProperties = {
      position: 'absolute',
      top: itemOffsets[i],
      left: 0,
      right: 0,
      height: h,
    };
    visibleItems.push(
      <div key={keyExtractor(item, i)} style={style}>
        {renderItem(item, i, style)}
      </div>
    );
  }

  return (
    <div
      ref={mergedRef}
      className={cn('overflow-auto relative', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div
        className={cn('relative', innerClassName)}
        style={{ height: totalHeight }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

export const VirtualizedList = memo(forwardRef(VirtualizedListInner)) as <T>(
  props: VirtualizedListProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

// ============================================
// VIRTUALIZED GRID
// ============================================

function VirtualizedGridInner<T>(
  {
    items,
    itemHeight,
    itemWidth,
    renderItem,
    keyExtractor = (_item, index) => String(index),
    height = '100%',
    overscan = 2,
    className,
    gap = 0,
  }: VirtualizedGridProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Merge refs
  const mergedRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  }, [ref]);

  // Calculate grid layout
  const { columns, rowCount, totalHeight } = useMemo(() => {
    const cols = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
    const rows = Math.ceil(items.length / cols);
    return {
      columns: cols,
      rowCount: rows,
      totalHeight: rows * (itemHeight + gap) - gap,
    };
  }, [containerWidth, itemWidth, itemHeight, gap, items.length]);

  // Get visible range
  const { startRow, endRow } = useMemo(() => {
    if (containerHeight === 0) {
      return { startRow: 0, endRow: Math.min(3, rowCount) };
    }

    const rowHeight = itemHeight + gap;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleRows = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(rowCount, start + visibleRows + 2 * overscan);

    return { startRow: start, endRow: end };
  }, [scrollTop, containerHeight, itemHeight, gap, rowCount, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.clientWidth);
    setContainerHeight(container.clientHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle empty state
  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <span className="text-muted-foreground">No items</span>
      </div>
    );
  }

  // Render visible items
  const visibleItems = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index >= items.length) break;

      const item = items[index];
      const style: React.CSSProperties = {
        position: 'absolute',
        top: row * (itemHeight + gap),
        left: col * (itemWidth + gap),
        width: itemWidth,
        height: itemHeight,
      };

      visibleItems.push(
        <div key={keyExtractor(item, index)} style={style}>
          {renderItem(item, index, style)}
        </div>
      );
    }
  }

  return (
    <div
      ref={mergedRef}
      className={cn('overflow-auto relative', className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div className="relative" style={{ height: totalHeight }}>
        {visibleItems}
      </div>
    </div>
  );
}

export const VirtualizedGrid = memo(forwardRef(VirtualizedGridInner)) as <T>(
  props: VirtualizedGridProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

// ============================================
// SIMPLE WINDOWED LIST (for simpler use cases)
// ============================================

interface SimpleWindowedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  windowSize?: number;
  className?: string;
}

export function SimpleWindowedList<T>({
  items,
  renderItem,
  windowSize = 20,
  className,
}: SimpleWindowedListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(windowSize);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < items.length) {
          setVisibleCount(prev => Math.min(prev + windowSize, items.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, items.length, windowSize]);

  // Reset when items change
  useEffect(() => {
    setVisibleCount(windowSize);
  }, [items.length, windowSize]);

  return (
    <div className={className}>
      {items.slice(0, visibleCount).map((item, index) => (
        <React.Fragment key={index}>
          {renderItem(item, index)}
        </React.Fragment>
      ))}
      {visibleCount < items.length && (
        <div ref={loaderRef} className="h-4" />
      )}
    </div>
  );
}

export default VirtualizedList;
