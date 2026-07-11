import { describe, expect, it } from 'vitest';
import {
  streakEndingAt,
  trailingCount,
  streakTone,
  buildCellWorkloadMap,
  buildTechWorkloadSummaries,
  computeDepartmentPercentiles,
  DEFAULT_WORKLOAD_THRESHOLDS,
} from '../workload';

describe('streakEndingAt', () => {
  it('returns 0 when the date itself is not worked', () => {
    const set = new Set(['2026-07-10', '2026-07-11']);
    expect(streakEndingAt(set, '2026-07-15')).toBe(0);
  });

  it('counts consecutive days ending at the given date', () => {
    const set = new Set(['2026-07-12', '2026-07-13', '2026-07-14']);
    expect(streakEndingAt(set, '2026-07-14')).toBe(3);
  });

  it('stops at a gap', () => {
    const set = new Set(['2026-07-10', '2026-07-13', '2026-07-14']);
    expect(streakEndingAt(set, '2026-07-14')).toBe(2);
  });

  it('handles a month boundary correctly', () => {
    const set = new Set(['2026-06-30', '2026-07-01', '2026-07-02']);
    expect(streakEndingAt(set, '2026-07-02')).toBe(3);
  });
});

describe('trailingCount', () => {
  it('counts days within the trailing window, including the reference day', () => {
    // window is [07-08, 07-14]; all three dates below fall inside it
    const set = new Set(['2026-07-09', '2026-07-10', '2026-07-14']);
    expect(trailingCount(set, '2026-07-14', 7)).toBe(3);
  });

  it('excludes days outside the trailing window', () => {
    // 07-07 is outside the 7-day window [07-08, 07-14]
    const set = new Set(['2026-07-07', '2026-07-14']);
    expect(trailingCount(set, '2026-07-14', 7)).toBe(1);
  });

  it('returns 0 for an empty set', () => {
    expect(trailingCount(new Set(), '2026-07-14', 7)).toBe(0);
  });
});

describe('streakTone', () => {
  it('maps streak length to tone using thresholds', () => {
    expect(streakTone(3, DEFAULT_WORKLOAD_THRESHOLDS)).toBe('neutral');
    expect(streakTone(6, DEFAULT_WORKLOAD_THRESHOLDS)).toBe('warn');
    expect(streakTone(10, DEFAULT_WORKLOAD_THRESHOLDS)).toBe('high');
  });
});

describe('buildCellWorkloadMap', () => {
  it('only emits cells for dates the technician actually worked, within the given range', () => {
    const datesByTech = new Map([['tech-1', new Set(['2026-07-14', '2026-07-15'])]]);
    const map = buildCellWorkloadMap(datesByTech, ['2026-07-14', '2026-07-15', '2026-07-16']);

    expect(map.get('tech-1-2026-07-14')?.streak).toBe(1);
    expect(map.get('tech-1-2026-07-15')?.streak).toBe(2);
    expect(map.has('tech-1-2026-07-16')).toBe(false);
  });

  it('computes correct streaks near the left edge using lookback data outside the visible range', () => {
    // lookback includes 07-12/07-13, visible range starts 07-14
    const datesByTech = new Map([['tech-1', new Set(['2026-07-12', '2026-07-13', '2026-07-14'])]]);
    const map = buildCellWorkloadMap(datesByTech, ['2026-07-14']);
    expect(map.get('tech-1-2026-07-14')?.streak).toBe(3);
  });
});

describe('buildTechWorkloadSummaries', () => {
  it('computes streak/trailing7/monthCount as of the reference date, independent of scroll position', () => {
    const datesByTech = new Map([
      ['tech-1', new Set(['2026-07-13', '2026-07-14', '2026-07-01'])],
    ]);
    const summaries = buildTechWorkloadSummaries(datesByTech, '2026-07-14');
    const summary = summaries.get('tech-1')!;
    expect(summary.streakEndingToday).toBe(2);
    expect(summary.monthCount).toBe(3);
  });
});

describe('computeDepartmentPercentiles', () => {
  it('ranks technicians within their own department only', () => {
    const counts = new Map([
      ['sound-low', 1],
      ['sound-high', 5],
      ['lights-only', 100], // different department, must not affect sound percentiles
    ]);
    const departments = new Map([
      ['sound-low', 'sound'],
      ['sound-high', 'sound'],
      ['lights-only', 'lights'],
    ]);

    const percentiles = computeDepartmentPercentiles(counts, departments);
    expect(percentiles.get('sound-low')).toBe(0);
    expect(percentiles.get('sound-high')).toBe(100);
    expect(percentiles.get('lights-only')).toBe(100); // sole member of its department
  });

  it('gives everyone the 100th percentile when tied', () => {
    const counts = new Map([['a', 3], ['b', 3]]);
    const departments = new Map([['a', 'sound'], ['b', 'sound']]);
    const percentiles = computeDepartmentPercentiles(counts, departments);
    expect(percentiles.get('a')).toBe(0);
    expect(percentiles.get('b')).toBe(100);
  });
});
