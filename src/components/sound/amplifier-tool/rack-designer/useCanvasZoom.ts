import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;
const ZOOM_STEP = 1.25;

interface UseCanvasZoomOptions {
  /** Attach listeners only while the canvas is mounted (dialog open). */
  enabled: boolean;
  contentWidth: number;
  contentHeight: number;
}

const touchDistance = (touches: TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

const touchMidpoint = (touches: TouchList) => ({
  clientX: (touches[0].clientX + touches[1].clientX) / 2,
  clientY: (touches[0].clientY + touches[1].clientY) / 2,
});

/**
 * Zoom state for the rack canvas: pinch-to-zoom on touch, Ctrl/trackpad wheel
 * zoom on desktop, plus programmatic in/out/fit. Zooming keeps the gesture's
 * focal point anchored by compensating the container's scroll position.
 *
 * Attach the returned `scrollRef` as the scroll container's ref. It is a
 * callback ref backed by state — the container lives inside a Radix portal
 * that mounts a commit after the dialog opens, so a plain RefObject would be
 * null when the listener effect first runs.
 *
 * `pinchActiveRef` is exposed so block drag handlers can freeze while pinching.
 */
export function useCanvasZoom({ enabled, contentWidth, contentHeight }: UseCanvasZoomOptions) {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  const pinchActiveRef = useRef(false);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);

  const applyZoom = useCallback(
    (next: number, anchor?: { clientX: number; clientY: number }) => {
      const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
      const previous = zoomRef.current;
      zoomRef.current = clamped;
      setZoomState(clamped);
      if (!scrollEl || previous === 0) return;
      const rect = scrollEl.getBoundingClientRect();
      const anchorX = anchor ? anchor.clientX - rect.left : rect.width / 2;
      const anchorY = anchor ? anchor.clientY - rect.top : rect.height / 2;
      pendingScroll.current = {
        left: ((scrollEl.scrollLeft + anchorX) / previous) * clamped - anchorX,
        top: ((scrollEl.scrollTop + anchorY) / previous) * clamped - anchorY,
      };
    },
    [scrollEl],
  );

  // Scroll compensation must run after React commits the resized canvas,
  // otherwise the new offsets get clamped against the old scroll bounds.
  useLayoutEffect(() => {
    if (scrollEl && pendingScroll.current) {
      scrollEl.scrollLeft = pendingScroll.current.left;
      scrollEl.scrollTop = pendingScroll.current.top;
      pendingScroll.current = null;
    }
  }, [zoom, scrollEl]);

  const zoomIn = useCallback(() => applyZoom(zoomRef.current * ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(zoomRef.current / ZOOM_STEP), [applyZoom]);

  const fitToView = useCallback(() => {
    if (!scrollEl) return;
    applyZoom(
      Math.min(
        (scrollEl.clientWidth - 24) / contentWidth,
        (scrollEl.clientHeight - 24) / contentHeight,
        1,
      ),
    );
  }, [applyZoom, contentHeight, contentWidth, scrollEl]);

  useEffect(() => {
    if (!enabled || !scrollEl) return;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      pinchActiveRef.current = true;
      pinchStart.current = { distance: touchDistance(event.touches), zoom: zoomRef.current };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchStart.current) return;
      event.preventDefault();
      const scale = touchDistance(event.touches) / pinchStart.current.distance;
      applyZoom(pinchStart.current.zoom * scale, touchMidpoint(event.touches));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) return;
      pinchStart.current = null;
      // Small delay so a lifted pinch finger doesn't register as a block tap.
      window.setTimeout(() => {
        pinchActiveRef.current = false;
      }, 80);
    };

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(zoomRef.current * Math.exp(-event.deltaY * 0.002), {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: false });
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false });
    scrollEl.addEventListener('touchend', onTouchEnd);
    scrollEl.addEventListener('touchcancel', onTouchEnd);
    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      scrollEl.removeEventListener('touchstart', onTouchStart);
      scrollEl.removeEventListener('touchmove', onTouchMove);
      scrollEl.removeEventListener('touchend', onTouchEnd);
      scrollEl.removeEventListener('touchcancel', onTouchEnd);
      scrollEl.removeEventListener('wheel', onWheel);
      pinchActiveRef.current = false;
      pinchStart.current = null;
    };
  }, [enabled, scrollEl, applyZoom]);

  return { zoom, zoomIn, zoomOut, fitToView, pinchActiveRef, scrollRef: setScrollEl };
}
