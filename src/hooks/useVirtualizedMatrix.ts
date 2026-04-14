import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

interface VirtualizedMatrixProps {
  totalRows: number;
  totalCols: number;
  rowHeight: number;
  colWidth: number;
  containerHeight: number;
  containerWidth: number;
  overscan?: number;
  overscanRows?: number;
  overscanCols?: number;
  overscanProfile?: 'mobile' | 'desktop';
  scrollLeft?: number;
  scrollTop?: number;
}

export const useVirtualizedMatrix = ({
  totalRows,
  totalCols,
  rowHeight,
  colWidth,
  containerHeight,
  containerWidth,
  overscan = 5,
  overscanRows,
  overscanCols,
  overscanProfile,
  scrollLeft: controlledScrollLeft,
  scrollTop: controlledScrollTop
}: VirtualizedMatrixProps) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolvedOverscan = useMemo(() => {
    if (overscanProfile === 'mobile') {
      return { rows: 6, cols: 4 };
    }
    if (overscanProfile === 'desktop') {
      return { rows: 10, cols: 6 };
    }
    return {
      rows: overscanRows ?? overscan,
      cols: overscanCols ?? overscan,
    };
  }, [overscan, overscanCols, overscanProfile, overscanRows]);

  const effectiveScrollLeft = controlledScrollLeft ?? scrollLeft;
  const effectiveScrollTop = controlledScrollTop ?? scrollTop;

  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(effectiveScrollTop / rowHeight) - resolvedOverscan.rows);
    const endRow = Math.min(
      totalRows - 1,
      Math.ceil((effectiveScrollTop + containerHeight) / rowHeight) + resolvedOverscan.rows,
    );
    const startCol = Math.max(0, Math.floor(effectiveScrollLeft / colWidth) - resolvedOverscan.cols);
    const endCol = Math.min(
      totalCols - 1,
      Math.ceil((effectiveScrollLeft + containerWidth) / colWidth) + resolvedOverscan.cols,
    );

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      visibleRows: endRow - startRow + 1,
      visibleCols: endCol - startCol + 1
    };
  }, [
    effectiveScrollTop,
    effectiveScrollLeft,
    rowHeight,
    colWidth,
    containerHeight,
    containerWidth,
    totalRows,
    totalCols,
    resolvedOverscan,
  ]);

  const visibleWindow = useMemo(
    () => ({
      rows: { start: visibleRange.startRow, end: visibleRange.endRow },
      cols: { start: visibleRange.startCol, end: visibleRange.endCol },
    }),
    [visibleRange.endCol, visibleRange.endRow, visibleRange.startCol, visibleRange.startRow],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollLeft(target.scrollLeft);
    setScrollTop(target.scrollTop);
  }, []);

  // Calculate total dimensions
  const totalHeight = totalRows * rowHeight;
  const totalWidth = totalCols * colWidth;
  const viewport = useMemo(
    () => ({
      width: containerWidth,
      height: containerHeight,
      scrollLeft: effectiveScrollLeft,
      scrollTop: effectiveScrollTop,
    }),
    [containerHeight, containerWidth, effectiveScrollLeft, effectiveScrollTop],
  );

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
    visibleRows: visibleWindow.rows,
    visibleCols: visibleWindow.cols,
    viewport,
    window: visibleWindow,
    overscan: resolvedOverscan,
    scrollLeft,
    scrollTop,
    totalHeight,
    totalWidth,
    matrixHeight: totalHeight,
    matrixWidth: totalWidth,
    handleScroll,
    scrollToPosition,
    scrollToCell,
    scrollRef
  };
};
