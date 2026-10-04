export interface GridPosition {
  row: number;
  col: number;
}

export interface GridSize {
  rows: number;
  cols: number;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max - 1, 0));

export type NavigationKey =
  | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
  | 'Home' | 'End' | 'PageUp' | 'PageDown';

export const isNavigationKey = (key: string): key is NavigationKey =>
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(key);

/** A week of days, the step of PageUp / PageDown. */
export const PAGE_STEP = 7;

/**
 * Where an arrow, Home/End or PageUp/PageDown key takes the active cell.
 * Moves clamp at the edges; Ctrl+Home / Ctrl+End jump to the grid's corners.
 */
export function nextPosition(
  from: GridPosition,
  key: NavigationKey,
  size: GridSize,
  { ctrl = false }: { ctrl?: boolean } = {},
): GridPosition {
  switch (key) {
    case 'ArrowUp': return { row: clamp(from.row - 1, size.rows), col: from.col };
    case 'ArrowDown': return { row: clamp(from.row + 1, size.rows), col: from.col };
    case 'ArrowLeft': return { row: from.row, col: clamp(from.col - 1, size.cols) };
    case 'ArrowRight': return { row: from.row, col: clamp(from.col + 1, size.cols) };
    case 'PageUp': return { row: from.row, col: clamp(from.col - PAGE_STEP, size.cols) };
    case 'PageDown': return { row: from.row, col: clamp(from.col + PAGE_STEP, size.cols) };
    case 'Home': return { row: ctrl ? 0 : from.row, col: 0 };
    case 'End': return { row: ctrl ? clamp(size.rows - 1, size.rows) : from.row, col: clamp(size.cols - 1, size.cols) };
  }
}

export interface ScrollMetrics {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
}

export interface GridMetrics {
  cellWidth: number;
  cellHeight: number;
  /** Frozen technician column on the left. */
  technicianWidth: number;
  /** Frozen date header on top. */
  headerHeight: number;
}

/**
 * The scroll offsets that bring a cell fully into view, clear of the frozen
 * column and header; unchanged when it is already visible.
 */
export function scrollToReveal(position: GridPosition, scroll: ScrollMetrics, grid: GridMetrics): { left: number; top: number } {
  const cellLeft = grid.technicianWidth + position.col * grid.cellWidth;
  const cellTop = grid.headerHeight + position.row * grid.cellHeight;
  let left = scroll.scrollLeft;
  let top = scroll.scrollTop;
  if (cellLeft < left + grid.technicianWidth) left = cellLeft - grid.technicianWidth;
  else if (cellLeft + grid.cellWidth > left + scroll.clientWidth) left = cellLeft + grid.cellWidth - scroll.clientWidth;
  if (cellTop < top + grid.headerHeight) top = cellTop - grid.headerHeight;
  else if (cellTop + grid.cellHeight > top + scroll.clientHeight) top = cellTop + grid.cellHeight - scroll.clientHeight;
  return { left: Math.max(left, 0), top: Math.max(top, 0) };
}

/** Where the ring is drawn inside the grid canvas. */
export const cellBox = (position: GridPosition, grid: GridMetrics) => ({
  left: grid.technicianWidth + position.col * grid.cellWidth,
  top: grid.headerHeight + position.row * grid.cellHeight,
  width: grid.cellWidth,
  height: grid.cellHeight,
});

/** Keys the grid understands, for the help sheet and the Stream Deck registry. */
export const MATRIX_SHORTCUT_HELP: Array<{ keys: string; label: string }> = [
  { keys: '← ↑ ↓ →', label: 'Moverse por la matriz' },
  { keys: 'Re Pág / Av Pág', label: 'Saltar una semana' },
  { keys: 'Inicio / Fin', label: 'Primer o último día' },
  { keys: 'Intro', label: 'Abrir las acciones de la celda' },
  { keys: 'C', label: 'Confirmar la asignación' },
  { keys: 'X', label: 'Rechazar la asignación' },
  { keys: 'Supr', label: 'Quitar la asignación' },
  { keys: 'N', label: 'Marcar o quitar no disponible' },
  { keys: 'F', label: 'Enfocar el trabajo de la celda (o salir del enfoque)' },
  { keys: 'Esc', label: 'Cerrar, salir del enfoque o soltar la celda' },
  { keys: '?', label: 'Ver esta ayuda' },
];
