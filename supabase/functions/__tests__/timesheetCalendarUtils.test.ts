import { describe, expect, it } from 'vitest';
import { groupTimesheetAssignments, TimesheetCalendarRow } from '../_shared/timesheetCalendarUtils';

describe('groupTimesheetAssignments', () => {
  const baseRows: TimesheetCalendarRow[] = [
    { job_id: 'job-1', date: '2025-04-01' },
    { job_id: 'job-1', date: '2025-04-02' },
    { job_id: 'job-1', date: '2025-04-04' },
    { job_id: 'job-2', date: '2025-04-05' },
  ];

  it('collapses contiguous days into blocks', () => {
    const blocks = groupTimesheetAssignments(baseRows);
    const job1Blocks = blocks.filter((b) => b.job_id === 'job-1');
    expect(job1Blocks).toHaveLength(2);
    expect(job1Blocks[0]?.dates).toEqual(['2025-04-01', '2025-04-02']);
    expect(job1Blocks[1]?.dates).toEqual(['2025-04-04']);
  });

  it('deduplicates repeated dates before grouping', () => {
    const withDuplicate: TimesheetCalendarRow[] = [...baseRows, { job_id: 'job-1', date: '2025-04-02' }];
    const blocks = groupTimesheetAssignments(withDuplicate);
    const job1Blocks = blocks.filter((b) => b.job_id === 'job-1');
    expect(job1Blocks[0]?.dates).toEqual(['2025-04-01', '2025-04-02']);
  });

  it('drops events when a per-day row disappears', () => {
    const withoutSecondDay = baseRows.filter((row) => row.date !== '2025-04-02');
    const original = groupTimesheetAssignments(baseRows);
    const without = groupTimesheetAssignments(withoutSecondDay);
    const originalDates = original.find((b) => b.job_id === 'job-1' && b.dates.includes('2025-04-02'));
    expect(originalDates?.dates).toContain('2025-04-02');
    const missing = without.find((b) => b.job_id === 'job-1' && b.dates.includes('2025-04-02'));
    expect(missing).toBeUndefined();
  });
});
