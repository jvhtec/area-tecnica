import React from 'react';
import { rangeKeys, selectionRects, type CellRef, type SelectionRect } from '@/features/matrix-v2/batch/selection';
import type { GridMetrics } from '@/features/matrix-v2/keyboard/navigation';

interface Options {
  /** Matrix v2 on a pointer device (phones select with a long press and taps). */
  enabled: boolean;
  /** Esc clears the selection (Matrix v2, any device with a keyboard). */
  clearOnEscape: boolean;
  technicianIds: string[];
  dateKeys: string[];
  selectedCells: Set<string>;
  /** Replaces the selection; `anchor` is the cell a later shift-click extends from. */
  onReplaceSelection: (keys: Set<string>) => void;
  /** The keyboard's active cell, the anchor when nothing else is. */
  getFallbackAnchor: () => CellRef | null;
  /** The grid's scroll container and sizes, so a drag near an edge scrolls the grid. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  grid: GridMetrics;
}

/** How close to an edge (px) a drag starts scrolling, and how far it scrolls per frame. */
const EDGE_ZONE = 48;
const EDGE_SPEED = 16;

const CELL = '[data-technician-id][data-date-key]';
const MODIFIER_KEYS = (event: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }) => event.ctrlKey || event.metaKey || event.altKey;

const cellFromTarget = (target: EventTarget | null): CellRef | null => {
  const element = target instanceof Element ? target.closest<HTMLElement>(CELL) : null;
  const technicianId = element?.dataset.technicianId;
  const dateKey = element?.dataset.dateKey;
  return technicianId && dateKey ? { technicianId, dateKey } : null;
};
const sameCell = (a: CellRef, b: CellRef) => a.technicianId === b.technicianId && a.dateKey === b.dateKey;
const union = (a: Set<string>, b: Set<string>) => new Set([...a, ...b]);

interface Drag {
  start: CellRef;
  current: CellRef;
  base: Set<string>;
  dragging: boolean;
}

/**
 * Mouse selection on the grid: drag a rectangle, shift-click to extend from the
 * last cell, ctrl-click to add. It listens on the grid as a whole (cells are
 * found by their data attributes), so cells need no props for it, and the drag
 * preview is one overlay that never re-renders a cell.
 */
export function useGridSelectionGestures(options: Options) {
  const { enabled, technicianIds, dateKeys, selectedCells } = options;
  const latest = React.useRef(options);
  latest.current = options;

  const [preview, setPreview] = React.useState<Set<string> | null>(null);
  const drag = React.useRef<Drag | null>(null);
  const anchor = React.useRef<CellRef | null>(null);
  const suppressClick = React.useRef(false);
  const cleanup = React.useRef<(() => void) | null>(null);

  const rowOf = React.useMemo(() => new Map(technicianIds.map((id, index) => [id, index])), [technicianIds]);
  const colOf = React.useMemo(() => new Map(dateKeys.map((key, index) => [key, index])), [dateKeys]);

  const current = (state: Drag) => union(state.base, rangeKeys(state.start, state.current, latest.current.technicianIds, latest.current.dateKeys));

  const onPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!latest.current.enabled || event.button !== 0 || event.pointerType !== 'mouse' || event.shiftKey) return;
    const start = cellFromTarget(event.target);
    if (!start) return;
    suppressClick.current = false;
    const state: Drag = {
      start, current: start, dragging: false,
      base: MODIFIER_KEYS(event) ? new Set(latest.current.selectedCells) : new Set(),
    };
    drag.current = state;

    let pointer = { x: event.clientX, y: event.clientY };
    let frame = 0;
    const update = () => {
      const cell = cellFromTarget(document.elementFromPoint(pointer.x, pointer.y));
      if (!cell || (!state.dragging && sameCell(cell, state.start)) || sameCell(cell, state.current)) return;
      if (!state.dragging) window.getSelection()?.removeAllRanges();
      state.dragging = true;
      state.current = cell;
      setPreview(current(state));
    };
    // Held near an edge, the grid keeps scrolling under the pointer, and the cell under it is followed.
    const autoScroll = () => {
      frame = 0;
      const element = latest.current.scrollRef.current;
      if (!element || !state.dragging) return;
      const rect = element.getBoundingClientRect();
      const { technicianWidth, headerHeight } = latest.current.grid;
      const dx = pointer.x > rect.right - EDGE_ZONE ? EDGE_SPEED : pointer.x < rect.left + technicianWidth + EDGE_ZONE ? -EDGE_SPEED : 0;
      const dy = pointer.y > rect.bottom - EDGE_ZONE ? EDGE_SPEED : pointer.y < rect.top + headerHeight + EDGE_ZONE ? -EDGE_SPEED : 0;
      if (dx === 0 && dy === 0) return;
      element.scrollBy(dx, dy);
      update();
      frame = requestAnimationFrame(autoScroll);
    };
    const onMove = (move: PointerEvent) => {
      pointer = { x: move.clientX, y: move.clientY };
      update();
      if (state.dragging && frame === 0) frame = requestAnimationFrame(autoScroll);
    };
    const finish = (commit: boolean) => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      cleanup.current = null;
      drag.current = null;
      setPreview(null);
      if (!state.dragging) return;
      // The click the browser still delivers after a drag is not a click on a cell.
      suppressClick.current = true;
      if (commit) {
        anchor.current = state.start;
        latest.current.onReplaceSelection(current(state));
      }
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    cleanup.current = () => finish(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }, []);

  const onClickCapture = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!latest.current.enabled) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    const cell = cellFromTarget(event.target);
    if (!cell) return;
    if (event.shiftKey) {
      event.stopPropagation();
      event.preventDefault();
      const from = anchor.current ?? latest.current.getFallbackAnchor() ?? cell;
      const range = rangeKeys(from, cell, latest.current.technicianIds, latest.current.dateKeys);
      latest.current.onReplaceSelection(MODIFIER_KEYS(event) ? union(latest.current.selectedCells, range) : range);
      return;
    }
    // A ctrl-click toggles the cell itself; remember it as where a shift-click starts.
    if (MODIFIER_KEYS(event)) anchor.current = cell;
  }, []);

  React.useEffect(() => () => cleanup.current?.(), []);
  React.useEffect(() => {
    if (!enabled) setPreview(null);
  }, [enabled]);
  // Esc drops the selection, unless it is closing a popover, a dialog or a text field first.
  const hasSelection = selectedCells.size > 0;
  React.useEffect(() => {
    if (!options.clearOnEscape || !hasSelection) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]')) return;
      latest.current.onReplaceSelection(new Set());
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [options.clearOnEscape, hasSelection]);
  // Clearing the selection forgets the anchor.
  React.useEffect(() => {
    if (selectedCells.size === 0) anchor.current = null;
  }, [selectedCells]);

  const previewRects = React.useMemo<SelectionRect[]>(() => (preview ? selectionRects(preview, rowOf, colOf) : []), [preview, rowOf, colOf]);

  // The grid also pans when dragged (useDragScroll); where a drag selects, it must not. The pan hook skips [data-no-drag].
  const gridHandlers = { onPointerDown, onClickCapture, ...(enabled ? { 'data-no-drag': 'true' } : {}) };
  return { gridHandlers, previewRects };
}
