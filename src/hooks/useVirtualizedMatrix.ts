import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

interface VirtualizedMatrixProps {
  totalRows: number;
  totalCols: number;
  rowHeight: number;
  colWidth: number;
  containerHeight: number;
  containerWidth: number;
  overscan?: number;
}

export const useVirtualizedMatrix = ({
  totalRows,
  totalCols,
  rowHeight,
  colWidth,
  containerHeight,
  containerWidth,
  overscan = 5
}: VirtualizedMatrixProps) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan);
    const startCol = Math.max(0, Math.floor(scrollLeft / colWidth) - overscan);
    const endCol = Math.min(totalCols - 1, Math.ceil((scrollLeft + containerWidth) / colWidth) + overscan);

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      visibleRows: endRow - startRow + 1,
      visibleCols: endCol - startCol + 1
    };
  }, [scrollTop, scrollLeft, rowHeight, colWidth, containerHeight, containerWidth, totalRows, totalCols, overscan]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollLeft(target.scrollLeft);
    setScrollTop(target.scrollTop);
  }, []);

  // Calculate total dimensions
  const totalHeight = totalRows * rowHeight;
  const totalWidth = totalCols * colWidth;

  // Scroll to specific position
  const scrollToPosition = useCallback((left: number, top: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = left;
      scrollRef.current.scrollTop = top;
    }
  }, []);

  // Scroll to specific cell
  const scrollToCell = useCallback((row: number, col: number) => {
    const left = col * colWidth;
    const top = row * rowHeight;
    scrollToPosition(left, top);
  }, [colWidth, rowHeight, scrollToPosition]);

  return {
    visibleRange,
    scrollLeft,
    scrollTop,
    totalHeight,
    totalWidth,
    handleScroll,
    scrollToPosition,
    scrollToCell,
    scrollRef
  };
};