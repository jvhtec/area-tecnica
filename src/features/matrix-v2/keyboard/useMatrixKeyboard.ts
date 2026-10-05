import React from 'react';
import { formatMadridDateKey, isMadridToday } from '@/utils/timezoneUtils';
import {
  cellBox,
  isNavigationKey,
  nextPosition,
  scrollToReveal,
  type GridMetrics,
} from '@/features/matrix-v2/keyboard/navigation';

/** True when focus arrived by keyboard (not a mouse press). Where :focus-visible is unknown, assume it did. */
const focusedByKeyboard = (element: HTMLElement): boolean => {
  try {
    return typeof element.matches === 'function' ? element.matches(':focus-visible') : true;
  } catch {
    return true;
  }
};

export interface ActiveCell {
  technicianId: string;
  dateKey: string;
}

interface Options {
  /** Matrix v2 is on. */
  enabled: boolean;
  /** Technicians in the order the grid shows them. */
  technicianIds: string[];
  dates: Date[];
  grid: GridMetrics;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** One spoken line for the active cell, announced as it moves. */
  describeCell: (technicianId: string, dateKey: string) => string;
  /** The inspector is open: its own keys apply, the grid's do not. */
  blocked: boolean;
  actions: {
    open: (cell: ActiveCell) => void;
    confirm: (cell: ActiveCell) => void;
    decline: (cell: ActiveCell) => void;
    remove: (cell: ActiveCell) => void;
    toggleUnavailable: (cell: ActiveCell) => void;
    /** F: focuses the job of the cell (or leaves focus when already focused). */
    focusJob: (cell: ActiveCell) => void;
    /** Esc with no active cell: leaves job focus. Returns whether it did. */
    exitFocus: () => boolean;
  };
}

/**
 * Keyboard model of the grid: arrows move an active cell (a single ring drawn
 * over the grid, so no cell re-renders), Intro opens its inspector, and single
 * letters act on it. The grid keeps DOM focus, and the ring is announced with
 * aria-activedescendant plus a live region.
 */
export function useMatrixKeyboard({ enabled, technicianIds, dates, grid, scrollRef, describeCell, blocked, actions }: Options) {
  const [active, setActive] = React.useState<ActiveCell | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  const dateKeys = React.useMemo(() => dates.map((date) => formatMadridDateKey(date)), [dates]);
  const rowOf = React.useMemo(() => new Map(technicianIds.map((id, index) => [id, index])), [technicianIds]);
  const colOf = React.useMemo(() => new Map(dateKeys.map((key, index) => [key, index])), [dateKeys]);

  const position = React.useMemo(() => {
    if (!active) return null;
    const row = rowOf.get(active.technicianId);
    const col = colOf.get(active.dateKey);
    return row === undefined || col === undefined ? null : { row, col };
  }, [active, rowOf, colOf]);

  const reveal = React.useCallback((next: { row: number; col: number }) => {
    const element = scrollRef.current;
    if (!element) return;
    const target = scrollToReveal(next, {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
    }, grid);
    if (target.left !== element.scrollLeft || target.top !== element.scrollTop) element.scrollTo({ left: target.left, top: target.top });
  }, [scrollRef, grid]);

  const goTo = React.useCallback((next: { row: number; col: number }) => {
    const technicianId = technicianIds[next.row];
    const dateKey = dateKeys[next.col];
    if (technicianId === undefined || dateKey === undefined) return;
    setActive({ technicianId, dateKey });
    reveal(next);
  }, [technicianIds, dateKeys, reveal]);

  /** A mouse click makes its cell the active one, so the keys carry on from there. */
  const activate = React.useCallback((technicianId: string, dateKey: string) => {
    setActive({ technicianId, dateKey });
  }, []);

  const startPosition = React.useCallback(() => {
    const today = dates.findIndex((date) => isMadridToday(date));
    return { row: 0, col: today >= 0 ? today : 0 };
  }, [dates]);

  const onKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (!enabled || blocked || event.target !== event.currentTarget) return;
    if (event.altKey || event.metaKey) return;
    if (technicianIds.length === 0 || dates.length === 0) return;
    const { key } = event;

    if (isNavigationKey(key)) {
      event.preventDefault();
      goTo(position ? nextPosition(position, key, { rows: technicianIds.length, cols: dates.length }, { ctrl: event.ctrlKey }) : startPosition());
      return;
    }
    if (key === '?') {
      event.preventDefault();
      setHelpOpen(true);
      return;
    }
    if (key === 'Escape') {
      if (active) {
        event.preventDefault();
        setActive(null);
      } else if (actionsRef.current.exitFocus()) {
        event.preventDefault();
      }
      return;
    }
    if (event.ctrlKey) return;

    const cell = active && position ? active : null;
    const run = (action: (cell: ActiveCell) => void) => {
      event.preventDefault();
      if (cell) action(cell);
      else goTo(startPosition());
    };
    switch (key) {
      case 'Enter':
      case ' ':
        run(actionsRef.current.open);
        break;
      case 'c':
      case 'C':
        run(actionsRef.current.confirm);
        break;
      case 'x':
      case 'X':
        run(actionsRef.current.decline);
        break;
      case 'Delete':
      case 'Backspace':
        run(actionsRef.current.remove);
        break;
      case 'n':
      case 'N':
        run(actionsRef.current.toggleUnavailable);
        break;
      case 'f':
      case 'F':
        run(actionsRef.current.focusJob);
        break;
      default:
    }
  }, [enabled, blocked, technicianIds.length, dates.length, goTo, position, startPosition, active]);

  // Shown the first time the keyboard brings focus to the grid, so the ring does not appear from nowhere.
  // A mouse press on a cell's padding also focuses the grid; that must not move the view or start a ring.
  const onFocus = React.useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!enabled || event.target !== event.currentTarget || active || technicianIds.length === 0) return;
    if (!focusedByKeyboard(event.currentTarget)) return;
    goTo(startPosition());
  }, [enabled, active, technicianIds.length, goTo, startPosition]);

  const ring = enabled && position ? cellBox(position, grid) : null;
  const announcement = enabled && active && position ? describeCell(active.technicianId, active.dateKey) : '';
  const activeDescendant = active ? `mcell-${active.technicianId}-${active.dateKey}` : undefined;

  return { active, activate, clear: () => setActive(null), onKeyDown, onFocus, ring, announcement, activeDescendant, helpOpen, setHelpOpen };
}
