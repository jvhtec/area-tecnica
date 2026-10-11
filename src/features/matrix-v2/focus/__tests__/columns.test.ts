import { describe, expect, it } from 'vitest';
import { dimmedColumnRuns, firstJobColumn, jobColumnRuns } from '@/features/matrix-v2/focus/columns';

const KEYS = ['10-11', '10-12', '10-13', '10-14', '10-15', '10-16'];

describe('focus columns', () => {
  it('dims everything but the job days, as the fewest runs', () => {
    expect(dimmedColumnRuns(KEYS, ['10-13', '10-14'])).toEqual([{ start: 0, count: 2 }, { start: 4, count: 2 }]);
    expect(dimmedColumnRuns(KEYS, ['10-11', '10-16'])).toEqual([{ start: 1, count: 4 }]);
    expect(dimmedColumnRuns(KEYS, KEYS)).toEqual([]);
  });

  it('dims the whole grid when the job is off screen', () => {
    expect(dimmedColumnRuns(KEYS, ['11-01'])).toEqual([{ start: 0, count: 6 }]);
  });

  it('underlines the job days as runs, with gaps for days off', () => {
    expect(jobColumnRuns(KEYS, ['10-12', '10-13', '10-15'])).toEqual([{ start: 1, count: 2 }, { start: 4, count: 1 }]);
    expect(jobColumnRuns(KEYS, [])).toEqual([]);
  });

  it('finds the first job column', () => {
    expect(firstJobColumn(KEYS, ['10-14', '10-15'])).toBe(3);
    expect(firstJobColumn(KEYS, ['12-01'])).toBe(-1);
  });
});
