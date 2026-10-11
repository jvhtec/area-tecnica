/** A selected cell is `${technicianId}-${yyyy-MM-dd}`: the id is a uuid with dashes of its own, so the day is read off the end. */
export const cellKey = (technicianId: string, dateKey: string) => `${technicianId}-${dateKey}`;

export const parseCellKey = (key: string) => ({ technicianId: key.slice(0, -11), dateKey: key.slice(-10) });

export interface CellRef {
  technicianId: string;
  dateKey: string;
}

/** Every cell of the rectangle between two cells, in the order the grid shows rows and days. */
export function rangeKeys(from: CellRef, to: CellRef, technicianIds: string[], dateKeys: string[]): Set<string> {
  const rowA = technicianIds.indexOf(from.technicianId);
  const rowB = technicianIds.indexOf(to.technicianId);
  const colA = dateKeys.indexOf(from.dateKey);
  const colB = dateKeys.indexOf(to.dateKey);
  const keys = new Set<string>();
  if (rowA < 0 || rowB < 0 || colA < 0 || colB < 0) return keys;
  for (let row = Math.min(rowA, rowB); row <= Math.max(rowA, rowB); row += 1) {
    for (let col = Math.min(colA, colB); col <= Math.max(colA, colB); col += 1) {
      keys.add(cellKey(technicianIds[row], dateKeys[col]));
    }
  }
  return keys;
}

export interface SelectionRect {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

/**
 * The selection as few rectangles as possible: runs of days per row, with
 * consecutive rows of the same run merged. A dragged block is one element.
 */
export function selectionRects(keys: Iterable<string>, rowOf: Map<string, number>, colOf: Map<string, number>): SelectionRect[] {
  const byRow = new Map<number, number[]>();
  for (const key of keys) {
    const { technicianId, dateKey } = parseCellKey(key);
    const row = rowOf.get(technicianId);
    const col = colOf.get(dateKey);
    if (row === undefined || col === undefined) continue;
    const cols = byRow.get(row) ?? [];
    cols.push(col);
    byRow.set(row, cols);
  }
  const rects: SelectionRect[] = [];
  const open = new Map<string, SelectionRect>();
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const cols = [...new Set(byRow.get(row))].sort((a, b) => a - b);
    const runs: Array<{ col: number; cols: number }> = [];
    for (const col of cols) {
      const last = runs[runs.length - 1];
      if (last && last.col + last.cols === col) last.cols += 1;
      else runs.push({ col, cols: 1 });
    }
    const stillOpen = new Map<string, SelectionRect>();
    for (const run of runs) {
      const id = `${run.col}:${run.cols}`;
      const above = open.get(id);
      if (above && above.row + above.rows === row) {
        above.rows += 1;
        stillOpen.set(id, above);
      } else {
        const rect = { row, col: run.col, rows: 1, cols: run.cols };
        rects.push(rect);
        stillOpen.set(id, rect);
      }
    }
    open.clear();
    stillOpen.forEach((rect, id) => open.set(id, rect));
  }
  return rects;
}

export function summarizeSelection(keys: Iterable<string>): { cells: number; people: number } {
  const people = new Set<string>();
  let cells = 0;
  for (const key of keys) {
    cells += 1;
    people.add(parseCellKey(key).technicianId);
  }
  return { cells, people: people.size };
}

/** Selected days per technician, each list sorted. */
export function daysByTechnician(keys: Iterable<string>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const key of keys) {
    const { technicianId, dateKey } = parseCellKey(key);
    const days = result.get(technicianId) ?? [];
    days.push(dateKey);
    result.set(technicianId, days);
  }
  result.forEach((days, technicianId) => result.set(technicianId, [...new Set(days)].sort()));
  return result;
}
