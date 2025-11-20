import { describe, expect, it } from 'vitest';
import { buildDateRanges, groupTimesheetCollisions, type TimesheetCollisionRow } from '../vacationCollisionUtils';

let idCounter = 0;
const createRow = (overrides: Partial<TimesheetCollisionRow>): TimesheetCollisionRow => ({
  id: overrides.id ?? `row-${idCounter += 1}`,
  date: overrides.date ?? '2025-01-01',
  jobs: overrides.jobs ?? {
    id: 'job-1',
    title: 'Job 1',
    start_time: '2025-01-01T08:00:00Z',
    end_time: '2025-01-03T17:00:00Z',
    locations: [{ name: 'Main Hall' }],
  },
});

describe('buildDateRanges', () => {
  it('groups consecutive dates into a single range', () => {
    expect(buildDateRanges(['2025-01-01', '2025-01-02', '2025-01-04'])).toEqual([
      { start: '2025-01-01', end: '2025-01-02' },
      { start: '2025-01-04', end: '2025-01-04' },
    ]);
  });
});

describe('groupTimesheetCollisions', () => {
  it('groups per-job timesheets and preserves contiguous date ranges', () => {
    const rows: TimesheetCollisionRow[] = [
      createRow({ id: 'row-1', date: '2025-02-01' }),
      createRow({ id: 'row-2', date: '2025-02-02' }),
      createRow({ id: 'row-3', date: '2025-02-04' }),
      createRow({
        id: 'row-4',
        date: '2025-02-05',
        jobs: {
          id: 'job-2',
          title: 'Job 2',
          start_time: '2025-02-05T09:00:00Z',
          end_time: '2025-02-06T17:00:00Z',
          locations: [{ name: 'Studio' }],
        },
      }),
    ];

    const grouped = groupTimesheetCollisions(rows);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toMatchObject({
      jobId: 'job-1',
      title: 'Job 1',
      locationName: 'Main Hall',
      dateRanges: [
        { start: '2025-02-01', end: '2025-02-02' },
        { start: '2025-02-04', end: '2025-02-04' },
      ],
    });
    expect(grouped[1]).toMatchObject({
      jobId: 'job-2',
      title: 'Job 2',
      locationName: 'Studio',
      dateRanges: [{ start: '2025-02-05', end: '2025-02-05' }],
    });
  });
});

