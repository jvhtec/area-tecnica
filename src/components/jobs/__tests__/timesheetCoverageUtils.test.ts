import { describe, expect, it } from 'vitest';
import { buildTimesheetTooltip, formatTimesheetCoverage } from '../utils/timesheetCoverage';

describe('timesheet coverage utilities', () => {
  it('formats single-day ranges', () => {
    const label = formatTimesheetCoverage([{ start: '2025-03-10', end: '2025-03-10' }]);
    expect(label).toMatch(/Mar 10/);
  });

  it('formats multi-day ranges with separators', () => {
    const label = formatTimesheetCoverage([
      { start: '2025-03-10', end: '2025-03-12' },
      { start: '2025-03-15', end: '2025-03-15' },
    ]);
    expect(label).toContain('Mar 10');
    expect(label).toContain('Mar 12');
    expect(label.split(',').length).toBe(2);
  });

  it('builds tooltips with friendly date strings', () => {
    const tooltip = buildTimesheetTooltip(['2025-04-01', '2025-04-02']);
    expect(tooltip.split('\n')).toHaveLength(2);
    expect(tooltip).toContain('2025');
  });
});
