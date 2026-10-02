import React from "react";
import { createPortal } from "react-dom";

import {
  OptimizedMatrixCellTooltip,
  type OptimizedMatrixCellTooltipProps,
} from "@/components/matrix/optimized-matrix-cell/OptimizedMatrixCellTooltip";

/**
 * One hover tooltip for the whole assignment grid.
 *
 * Each cell used to carry its own Radix Tooltip root. With several hundred
 * cells mounted at once, and a fresh row or column of them mounted on every
 * scroll step, those roots (context, state, presence, a trigger wrapper) were a
 * large share of the cost of scrolling. Cells now only carry data attributes;
 * the grid forwards pointer movement here, and hovering re-renders this
 * component alone, never the grid.
 *
 * Timing follows the Radix defaults the grid used: open after 700ms, and move
 * straight to a neighbouring cell's tooltip within 300ms of the last one.
 */

const OPEN_DELAY_MS = 700;
const SKIP_DELAY_MS = 300;
const VIEWPORT_MARGIN = 8;
const MAX_WIDTH = 320; // max-w-xs
const GAP = 4;

export interface MatrixCellHoverTooltipHandle {
  /** The pointer is over this cell element (or over no cell, when null). */
  hover: (cell: HTMLElement | null) => void;
  /** Close at once: pointer left the grid, the grid scrolled, or a click. */
  hide: () => void;
}

interface MatrixCellHoverTooltipProps {
  /** Tooltip content for a cell, read from the grid's current data. */
  resolve: (technicianId: string, dateKey: string) => OptimizedMatrixCellTooltipProps | null;
}

interface OpenTooltip {
  technicianId: string;
  dateKey: string;
  rect: { top: number; bottom: number; left: number; width: number };
}

export const MatrixCellHoverTooltip = React.memo(
  React.forwardRef<MatrixCellHoverTooltipHandle, MatrixCellHoverTooltipProps>(({ resolve }, ref) => {
    const [open, setOpen] = React.useState<OpenTooltip | null>(null);
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoveredRef = React.useRef<HTMLElement | null>(null);
    const lastClosedAtRef = React.useRef(0);
    const isOpenRef = React.useRef(false);

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const close = React.useCallback(() => {
      clearTimer();
      hoveredRef.current = null;
      if (isOpenRef.current) {
        isOpenRef.current = false;
        lastClosedAtRef.current = Date.now();
        setOpen(null);
      }
    }, []);

    const openFor = React.useCallback((cell: HTMLElement) => {
      const technicianId = cell.dataset.technicianId;
      const dateKey = cell.dataset.dateKey;
      if (!technicianId || !dateKey || !cell.isConnected) return;
      const box = cell.getBoundingClientRect();
      isOpenRef.current = true;
      setOpen({
        technicianId,
        dateKey,
        rect: { top: box.top, bottom: box.bottom, left: box.left, width: box.width },
      });
    }, []);

    React.useImperativeHandle(
      ref,
      () => ({
        hover: (cell) => {
          if (cell === hoveredRef.current) return;
          clearTimer();
          hoveredRef.current = cell;
          if (!cell) {
            if (isOpenRef.current) close();
            return;
          }
          const warm = isOpenRef.current || Date.now() - lastClosedAtRef.current < SKIP_DELAY_MS;
          if (warm) {
            openFor(cell);
            return;
          }
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (hoveredRef.current === cell) openFor(cell);
          }, OPEN_DELAY_MS);
        },
        hide: close,
      }),
      [close, openFor],
    );

    React.useEffect(() => clearTimer, []);

    if (!open || typeof document === "undefined") return null;
    const content = resolve(open.technicianId, open.dateKey);
    if (!content) return null;

    // Above the cell, as the per-cell tooltip was (side="top"), unless there is
    // no room; horizontally centred on the cell and kept inside the viewport.
    const viewportWidth = window.innerWidth;
    const placeBelow = open.rect.top < 160;
    const centre = open.rect.left + open.rect.width / 2;
    const half = Math.min(MAX_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2) / 2;
    const left = Math.min(Math.max(centre, VIEWPORT_MARGIN + half), viewportWidth - VIEWPORT_MARGIN - half);
    const style: React.CSSProperties = {
      position: "fixed",
      left,
      top: placeBelow ? open.rect.bottom + GAP : open.rect.top - GAP,
      transform: placeBelow ? "translateX(-50%)" : "translate(-50%, -100%)",
      maxWidth: MAX_WIDTH,
    };

    return createPortal(
      <div
        role="tooltip"
        data-matrix-cell-tooltip="true"
        data-side={placeBelow ? "bottom" : "top"}
        style={style}
        className="pointer-events-none z-50 overflow-hidden rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      >
        <OptimizedMatrixCellTooltip {...content} />
      </div>,
      document.body,
    );
  }),
);

MatrixCellHoverTooltip.displayName = "MatrixCellHoverTooltip";
