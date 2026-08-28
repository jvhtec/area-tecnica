// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVirtualizedDateRange } from '@/hooks/useVirtualizedDateRange';
import { formatMadridDateKey } from '@/utils/timezoneUtils';

const keys = (dates: Date[]) => dates.map((d) => formatMadridDateKey(d));

describe('useVirtualizedDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('centres on the Madrid day even when the browser day differs', () => {
    // 23:30 UTC on 2026-05-31 is already 2026-06-01 in Madrid (CEST, UTC+2).
    // Under the previous local-midnight range this centred on May 31.
    vi.setSystemTime(new Date('2026-05-31T23:30:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 0, initialWeeksAfter: 0 }),
    );

    expect(keys(result.current.dateRange)).toEqual(['2026-06-01']);
    expect(result.current.todayIndex).toBe(0);
  });

  it('produces a contiguous run of Madrid days around the centre', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 1, initialWeeksAfter: 1 }),
    );

    const range = keys(result.current.dateRange);
    expect(range[0]).toBe('2026-05-13');
    expect(range[range.length - 1]).toBe('2026-05-27');
    expect(range).toHaveLength(15);
    expect(new Set(range).size).toBe(15);
    expect(result.current.rangeInfo.totalDays).toBe(15);
    // Every entry resolves back to the Madrid day it represents.
    expect(range).toEqual([...range].sort());
  });

  it('keeps one entry per calendar day across both DST transitions', () => {
    // Spring forward: 2026-03-29 is a 23-hour day in Madrid.
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));
    const spring = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 1, initialWeeksAfter: 1 }),
    );
    const springKeys = keys(spring.result.current.dateRange);
    expect(springKeys).toContain('2026-03-28');
    expect(springKeys).toContain('2026-03-29');
    expect(springKeys).toContain('2026-03-30');
    expect(new Set(springKeys).size).toBe(springKeys.length);

    // Fall back: 2026-10-25 is a 25-hour day in Madrid.
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const autumn = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 1, initialWeeksAfter: 1 }),
    );
    const autumnKeys = keys(autumn.result.current.dateRange);
    expect(autumnKeys).toContain('2026-10-24');
    expect(autumnKeys).toContain('2026-10-25');
    expect(autumnKeys).toContain('2026-10-26');
    expect(new Set(autumnKeys).size).toBe(autumnKeys.length);
  });

  it('expands by whole weeks of Madrid days', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 0, initialWeeksAfter: 0, expandByWeeks: 2 }),
    );

    expect(keys(result.current.dateRange)).toEqual(['2026-05-20']);

    act(() => {
      result.current.expandAfter();
    });
    let range = keys(result.current.dateRange);
    expect(range[0]).toBe('2026-05-20');
    expect(range[range.length - 1]).toBe('2026-06-03');

    act(() => {
      result.current.expandBefore();
    });
    range = keys(result.current.dateRange);
    expect(range[0]).toBe('2026-05-06');
    expect(range[range.length - 1]).toBe('2026-06-03');
  });

  it('reports the range boundaries as Madrid days', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 1, initialWeeksAfter: 1 }),
    );

    expect(formatMadridDateKey(result.current.rangeInfo.start)).toBe('2026-05-13');
    expect(formatMadridDateKey(result.current.rangeInfo.end)).toBe('2026-05-27');
    // Display labels are Spanish; cache keys use startKey/endKey.
    expect(result.current.rangeInfo.startFormatted).toBe('13 de mayo de 2026');
    expect(result.current.rangeInfo.endFormatted).toBe('27 de mayo de 2026');
    expect(result.current.rangeInfo.startKey).toBe('2026-05-13');
    expect(result.current.rangeInfo.endKey).toBe('2026-05-27');
  });

  it('jumps to the first Madrid day of the requested month', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 0, initialWeeksAfter: 0 }),
    );

    act(() => {
      result.current.jumpToMonth(2027, 1);
    });

    expect(keys(result.current.dateRange)).toEqual(['2027-01-01']);
  });

  it('projects the next window on the Madrid calendar', () => {
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));

    const { result } = renderHook(() =>
      useVirtualizedDateRange({ initialWeeksBefore: 0, initialWeeksAfter: 0, expandByWeeks: 1 }),
    );

    const projection = result.current.getProjectedRangeInfo('after');
    expect(projection).not.toBeNull();
    expect(formatMadridDateKey(projection!.rangeInfo.end)).toBe('2026-05-27');
  });
});
