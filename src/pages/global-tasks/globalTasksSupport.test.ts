import { describe, expect, it } from 'vitest';
import {
  dateInputValue,
  formatDateMadrid,
  formatDateTimeMadrid,
  normalizeDeptOrDefault,
} from './globalTasksSupport';

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
});
