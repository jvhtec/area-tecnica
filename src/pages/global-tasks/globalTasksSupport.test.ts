import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateInputValue,
  formatDateMadrid,
  formatDateTimeMadrid,
  isOverdueMadrid,
  normalizeDeptOrDefault,
} from '@/pages/global-tasks/globalTasksSupport';

afterEach(() => {
  vi.useRealTimers();
});

describe('global task page support', () => {
  it('normalizes valid departments and falls back safely', () => {
    expect(normalizeDeptOrDefault('production')).toBe('production');
    expect(normalizeDeptOrDefault('unknown')).toBe('sound');
    expect(normalizeDeptOrDefault(null)).toBe('sound');
  });

  it('formats UTC task deadlines in Madrid time', () => {
    const instant = '2026-07-22T22:30:00.000Z';

    expect(formatDateMadrid(instant)).toBe('23/07/2026');
    expect(formatDateTimeMadrid(instant)).toBe('23/07/2026 00:30');
    expect(dateInputValue(instant)).toBe('2026-07-23');
  });

  it('compares overdue deadlines as absolute instants across Madrid DST fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T01:10:00.000Z'));

    expect(isOverdueMadrid('2026-10-25T00:50:00.000Z')).toBe(true);
    expect(isOverdueMadrid('2026-10-25T01:20:00.000Z')).toBe(false);
    expect(isOverdueMadrid('not-an-instant')).toBe(false);
  });
});
