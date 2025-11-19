import { describe, expect, it } from 'vitest';
import { addDays, startOfMonth } from 'date-fns';
import { computeTechnicianTimesheetMetrics } from '../technicianMetrics';

describe('computeTechnicianTimesheetMetrics', () => {
  it('counts distinct job/day pairs per month and year', () => {
    const monthStart = startOfMonth(new Date('2025-03-05'));
    const rows = [
      { job_id: 'job-1', date: '2025-03-01' },
      { job_id: 'job-1', date: '2025-03-02' },
      { job_id: 'job-2', date: '2025-02-28' }
    ];

    const result = computeTechnicianTimesheetMetrics(rows, monthStart, addDays(monthStart, 30));

    expect(result.monthConfirmed).toBe(2);
    expect(result.yearConfirmed).toBe(3);
  });

  it('drops monthly totals when a single day is removed but keeps other months untouched', () => {
    const monthStart = startOfMonth(new Date('2025-04-02'));
    const monthEnd = addDays(monthStart, 29);

    const baseRows = [
      { job_id: 'job-3', date: '2025-04-10' },
      { job_id: 'job-3', date: '2025-04-11' },
      { job_id: 'job-4', date: '2025-05-01' }
    ];

    const full = computeTechnicianTimesheetMetrics(baseRows, monthStart, monthEnd);
    expect(full.monthConfirmed).toBe(2);
    expect(full.yearConfirmed).toBe(3);

    const withoutDay = computeTechnicianTimesheetMetrics(
      baseRows.filter(row => row.date !== '2025-04-11'),
      monthStart,
      monthEnd
    );

    expect(withoutDay.monthConfirmed).toBe(1);
    expect(withoutDay.yearConfirmed).toBe(2);
  });
});
