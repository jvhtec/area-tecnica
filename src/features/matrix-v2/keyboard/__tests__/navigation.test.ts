import { describe, expect, it } from 'vitest';
import { cellBox, nextPosition, scrollToReveal } from '@/features/matrix-v2/keyboard/navigation';

const size = { rows: 4, cols: 10 };

describe('nextPosition', () => {
  it('moves one cell with the arrows and stops at the edges', () => {
    expect(nextPosition({ row: 1, col: 1 }, 'ArrowRight', size)).toEqual({ row: 1, col: 2 });
    expect(nextPosition({ row: 1, col: 1 }, 'ArrowLeft', size)).toEqual({ row: 1, col: 0 });
    expect(nextPosition({ row: 1, col: 1 }, 'ArrowDown', size)).toEqual({ row: 2, col: 1 });
    expect(nextPosition({ row: 0, col: 0 }, 'ArrowUp', size)).toEqual({ row: 0, col: 0 });
    expect(nextPosition({ row: 0, col: 0 }, 'ArrowLeft', size)).toEqual({ row: 0, col: 0 });
    expect(nextPosition({ row: 3, col: 9 }, 'ArrowDown', size)).toEqual({ row: 3, col: 9 });
    expect(nextPosition({ row: 3, col: 9 }, 'ArrowRight', size)).toEqual({ row: 3, col: 9 });
  });

  it('jumps a week with the page keys, clamped', () => {
    expect(nextPosition({ row: 2, col: 1 }, 'PageDown', size)).toEqual({ row: 2, col: 8 });
    expect(nextPosition({ row: 2, col: 8 }, 'PageDown', size)).toEqual({ row: 2, col: 9 });
    expect(nextPosition({ row: 2, col: 3 }, 'PageUp', size)).toEqual({ row: 2, col: 0 });
  });

  it('Home and End stay in the row, with Ctrl they go to the corners', () => {
    expect(nextPosition({ row: 2, col: 5 }, 'Home', size)).toEqual({ row: 2, col: 0 });
    expect(nextPosition({ row: 2, col: 5 }, 'End', size)).toEqual({ row: 2, col: 9 });
    expect(nextPosition({ row: 2, col: 5 }, 'Home', size, { ctrl: true })).toEqual({ row: 0, col: 0 });
    expect(nextPosition({ row: 2, col: 5 }, 'End', size, { ctrl: true })).toEqual({ row: 3, col: 9 });
  });

  it('copes with an empty grid', () => {
    expect(nextPosition({ row: 0, col: 0 }, 'ArrowRight', { rows: 0, cols: 0 })).toEqual({ row: 0, col: 0 });
  });
});

describe('scrollToReveal', () => {
  const grid = { cellWidth: 100, cellHeight: 50, technicianWidth: 200, headerHeight: 80 };
  const viewport = { clientWidth: 600, clientHeight: 400 };

  it('leaves a visible cell alone', () => {
    expect(scrollToReveal({ row: 1, col: 1 }, { scrollLeft: 0, scrollTop: 0, ...viewport }, grid)).toEqual({ left: 0, top: 0 });
  });

  it('scrolls right and down just far enough', () => {
    // Column 6 spans 800-900 on a 600px viewport: it needs scrollLeft 300.
    expect(scrollToReveal({ row: 0, col: 6 }, { scrollLeft: 0, scrollTop: 0, ...viewport }, grid).left).toBe(300);
    // Row 9 spans 530-580 on a 400px viewport: it needs scrollTop 180.
    expect(scrollToReveal({ row: 9, col: 0 }, { scrollLeft: 0, scrollTop: 0, ...viewport }, grid).top).toBe(180);
  });

  it('scrolls back clear of the frozen column and header', () => {
    // Column 2 starts at 400; with scrollLeft 350 the frozen column covers 350-550.
    expect(scrollToReveal({ row: 0, col: 2 }, { scrollLeft: 350, scrollTop: 0, ...viewport }, grid).left).toBe(200);
    expect(scrollToReveal({ row: 0, col: 0 }, { scrollLeft: 0, scrollTop: 120, ...viewport }, grid).top).toBe(0);
  });

  it('never scrolls negative', () => {
    expect(scrollToReveal({ row: 0, col: 0 }, { scrollLeft: 0, scrollTop: 0, ...viewport }, grid)).toEqual({ left: 0, top: 0 });
  });
});

describe('cellBox', () => {
  it('places the ring from the indices alone', () => {
    expect(cellBox({ row: 2, col: 3 }, { cellWidth: 100, cellHeight: 50, technicianWidth: 200, headerHeight: 80 }))
      .toEqual({ left: 500, top: 180, width: 100, height: 50 });
  });
});
