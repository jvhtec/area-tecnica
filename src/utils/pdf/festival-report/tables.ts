export interface ConstantColumn {
  label: string;
  value: string;
}

export interface DropConstantColumnsResult<TRow> {
  head: string[];
  rows: TRow[][];
  /** Columns lifted out of the table, to be stated once beneath it. */
  constants: ConstantColumn[];
  /** Indexes (into the original head) that survived, in order. */
  keptIndexes: number[];
}

const cellToText = (cell: unknown): string => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  const content = (cell as { content?: unknown }).content;
  return content === undefined ? '' : String(content).trim();
};

/**
 * A column whose value is identical in every row is not data.
 *
 * Thirteen columns on A4 produce broken words in cells — *Ningun o*, *Lineas A
 * nalogicas*. Adding columns is not the problem; keeping columns that never
 * vary is. This lifts those columns out so they can be stated once under the
 * table, and it runs before anything reaches for landscape or a smaller size.
 */
export const dropConstantColumns = <TRow>(
  head: string[],
  rows: TRow[][],
  options: { protect?: number[]; minRows?: number } = {},
): DropConstantColumnsResult<TRow> => {
  const protect = new Set(options.protect ?? []);
  const minRows = options.minRows ?? 2;

  if (rows.length < minRows) {
    return { head, rows, constants: [], keptIndexes: head.map((_, index) => index) };
  }

  const constants: ConstantColumn[] = [];
  const keptIndexes: number[] = [];

  head.forEach((label, index) => {
    if (protect.has(index)) {
      keptIndexes.push(index);
      return;
    }

    const first = cellToText(rows[0][index]);
    const uniform = first.length > 0 && rows.every((row) => cellToText(row[index]) === first);

    if (uniform) {
      constants.push({ label, value: first.replace(/\s*\n\s*/g, ' ') });
    } else {
      keptIndexes.push(index);
    }
  });

  if (constants.length === 0) {
    return { head, rows, constants: [], keptIndexes };
  }

  return {
    head: keptIndexes.map((index) => head[index]),
    rows: rows.map((row) => keptIndexes.map((index) => row[index])),
    constants,
    keptIndexes,
  };
};

/**
 * Distributes a set of relative column weights across the available width so
 * `table-layout: fixed` behaviour is guaranteed — the browser-style "guess"
 * is what produces broken words inside cells.
 */
export const distributeColumnWidths = (
  weights: number[],
  availableWidth: number,
): Record<number, { cellWidth: number }> => {
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return weights.reduce<Record<number, { cellWidth: number }>>((styles, weight, index) => {
    styles[index] = { cellWidth: availableWidth * (weight / total) };
    return styles;
  }, {});
};
