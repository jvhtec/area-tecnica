import { describe, expect, it } from 'vitest';
import { cellKey, daysByTechnician, parseCellKey, rangeKeys, selectionRects, summarizeSelection } from '@/features/matrix-v2/batch/selection';

const IDS = ['0b3c-1111', 'aa22-2222', 'cc33-3333', 'dd44-4444'];
const DAYS = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
const rowOf = new Map(IDS.map((id, index) => [id, index]));
const colOf = new Map(DAYS.map((day, index) => [day, index]));

describe('cell keys', () => {
  it('round-trips ids that carry dashes of their own', () => {
    const key = cellKey('6f1c2d3e-aaaa-bbbb-cccc-0123456789ab', '2026-10-13');
    expect(parseCellKey(key)).toEqual({ technicianId: '6f1c2d3e-aaaa-bbbb-cccc-0123456789ab', dateKey: '2026-10-13' });
  });
});

describe('rangeKeys', () => {
  it('is the rectangle between two cells, whichever way it is dragged', () => {
    const forward = rangeKeys({ technicianId: IDS[0], dateKey: DAYS[1] }, { technicianId: IDS[2], dateKey: DAYS[2] }, IDS, DAYS);
    const backward = rangeKeys({ technicianId: IDS[2], dateKey: DAYS[2] }, { technicianId: IDS[0], dateKey: DAYS[1] }, IDS, DAYS);
    expect(forward.size).toBe(6);
    expect([...forward].sort()).toEqual([...backward].sort());
    expect(forward.has(cellKey(IDS[1], DAYS[1]))).toBe(true);
    expect(forward.has(cellKey(IDS[3], DAYS[1]))).toBe(false);
  });

  it('is one cell when both ends are the same, and empty for a cell that is not on the grid', () => {
    expect(rangeKeys({ technicianId: IDS[1], dateKey: DAYS[0] }, { technicianId: IDS[1], dateKey: DAYS[0] }, IDS, DAYS).size).toBe(1);
    expect(rangeKeys({ technicianId: 'nobody', dateKey: DAYS[0] }, { technicianId: IDS[1], dateKey: DAYS[0] }, IDS, DAYS).size).toBe(0);
  });
});

describe('selectionRects', () => {
  it('draws a dragged block as one rectangle', () => {
    const keys = rangeKeys({ technicianId: IDS[0], dateKey: DAYS[1] }, { technicianId: IDS[2], dateKey: DAYS[2] }, IDS, DAYS);
    expect(selectionRects(keys, rowOf, colOf)).toEqual([{ row: 0, col: 1, rows: 3, cols: 2 }]);
  });

  it('splits on gaps in days and in rows', () => {
    const keys = [cellKey(IDS[0], DAYS[0]), cellKey(IDS[0], DAYS[1]), cellKey(IDS[0], DAYS[3]), cellKey(IDS[2], DAYS[0]), cellKey(IDS[2], DAYS[1])];
    const rects = selectionRects(keys, rowOf, colOf);
    expect(rects).toHaveLength(3);
    expect(rects).toEqual(expect.arrayContaining([
      { row: 0, col: 0, rows: 1, cols: 2 },
      { row: 0, col: 3, rows: 1, cols: 1 },
      { row: 2, col: 0, rows: 1, cols: 2 },
    ]));
  });

  it('merges only consecutive rows that have exactly the same days', () => {
    const keys = [cellKey(IDS[0], DAYS[0]), cellKey(IDS[1], DAYS[0]), cellKey(IDS[1], DAYS[1])];
    expect(selectionRects(keys, rowOf, colOf)).toEqual([
      { row: 0, col: 0, rows: 1, cols: 1 },
      { row: 1, col: 0, rows: 1, cols: 2 },
    ]);
    // A row in between breaks the merge even when the days match.
    const gap = [cellKey(IDS[0], DAYS[0]), cellKey(IDS[2], DAYS[0])];
    expect(selectionRects(gap, rowOf, colOf)).toEqual([
      { row: 0, col: 0, rows: 1, cols: 1 },
      { row: 2, col: 0, rows: 1, cols: 1 },
    ]);
  });

  it('ignores cells that are not on the grid', () => {
    expect(selectionRects([cellKey('ghost', DAYS[0])], rowOf, colOf)).toEqual([]);
  });
});

describe('summaries', () => {
  it('counts cells and people', () => {
    const keys = [cellKey(IDS[0], DAYS[0]), cellKey(IDS[0], DAYS[1]), cellKey(IDS[1], DAYS[0])];
    expect(summarizeSelection(keys)).toEqual({ cells: 3, people: 2 });
    expect(daysByTechnician(keys).get(IDS[0])).toEqual([DAYS[0], DAYS[1]]);
  });
});
