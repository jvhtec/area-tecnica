import { useEffect, useRef, useCallback, RefObject } from 'react';

interface DragScrollOptions {
  /**
   * Callback to sync scroll position with other elements
   */
  onScroll?: (scrollLeft: number, scrollTop: number) => void;
  /**
   * Direction of drag scrolling
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | 'both';
  /**
   * Cursor style when dragging
   * @default 'grabbing'
   */
  cursorGrabbing?: string;
  /**
   * Cursor style when not dragging
   * @default 'grab'
   */
  cursorGrab?: string;
  /**
   * Whether drag scroll is enabled
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook to enable drag-to-scroll functionality on a scrollable element.
 * Click and drag to scroll horizontally/vertically.
 *
 * Can be used in two ways:
 * 1. Without an existing ref: returns a new ref to attach to an element
 * 2. With an existing ref: attaches behavior to that ref
 */
export function useDragScroll<T extends HTMLElement>(
  refOrOptions?: RefObject<T> | DragScrollOptions | null,
  maybeOptions?: DragScrollOptions
) {
  // Handle overloaded arguments
  const existingRef = refOrOptions && 'current' in refOrOptions ? refOrOptions : null;
  const options = existingRef ? (maybeOptions || {}) : (refOrOptions as DragScrollOptions || {});

  const {
    onScroll,
    direction = 'horizontal',
    cursorGrabbing = 'grabbing',
    cursorGrab = 'grab',
    enabled = true,
  } = options;

  const internalRef = useRef<T>(null);
  const ref = existingRef || internalRef;

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeftStart = useRef(0);
  const scrollTopStart = useRef(0);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const element = ref.current;
    if (!element) return;

    // Only start drag on left mouse button
    if (e.button !== 0) return;

    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('[role="button"]') ||
      target.closest('[data-no-drag]')
    ) {
      return;
    }

    isDragging.current = true;
    startX.current = e.pageX;
    startY.current = e.pageY;
    scrollLeftStart.current = element.scrollLeft;
    scrollTopStart.current = element.scrollTop;

    element.style.cursor = cursorGrabbing;
    element.style.userSelect = 'none';

    // Prevent text selection
    e.preventDefault();
  }, [cursorGrabbing]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const element = ref.current;
    if (!element) return;

    const dx = e.pageX - startX.current;
    const dy = e.pageY - startY.current;

    if (direction === 'horizontal' || direction === 'both') {
      element.scrollLeft = scrollLeftStart.current - dx;
    }
    if (direction === 'vertical' || direction === 'both') {
      element.scrollTop = scrollTopStart.current - dy;
    }

    if (onScroll) {
      onScroll(element.scrollLeft, element.scrollTop);
    }
  }, [direction, onScroll]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    const element = ref.current;

    isDragging.current = false;

    if (element) {
      element.style.cursor = cursorGrab;
      element.style.userSelect = '';
    }
  }, [cursorGrab]);

  const handleMouseLeave = useCallback(() => {
    // Stop dragging when mouse leaves the element
    if (isDragging.current) {
      handleMouseUp();
    }
  }, [handleMouseUp]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    // Set initial cursor
    element.style.cursor = cursorGrab;

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseLeave);
      // Reset cursor when disabled
      if (element) {
        element.style.cursor = '';
      }
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave, cursorGrab, enabled]);

  // Return the ref (useful when not using an existing ref)
  return existingRef ? undefined : internalRef;
}

export default useDragScroll;
