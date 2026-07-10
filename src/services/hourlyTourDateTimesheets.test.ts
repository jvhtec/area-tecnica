import { describe, expect, it } from 'vitest';

import { filterEligibleTourDateTimesheets } from '@/services/hourlyTourDateTimesheets';

const timesheets = [
  { id: 'hourly-match', technician_id: 'tech-1', date: '2026-07-10' },
  { id: 'same-date-other-tech', technician_id: 'tech-2', date: '2026-07-10' },
  { id: 'prep-day', technician_id: 'tech-2', date: '2026-07-09' },
  { id: 'ordinary-tourdate', technician_id: 'tech-1', date: '2026-07-11' },
];

describe('filterEligibleTourDateTimesheets', () => {
  it('keeps prep-day rows and exact technician/date hourly matches only', () => {
    const result = filterEligibleTourDateTimesheets(
      timesheets,
      new Set(['2026-07-09']),
      [{ job_id: 'job-1', technician_id: 'tech-1', date: '2026-07-10' }],
    );

    expect(result.map((row) => row.id)).toEqual(['hourly-match', 'prep-day']);
  });

  it('does not expose ordinary tour-date timesheets without an eligible mode', () => {
    expect(filterEligibleTourDateTimesheets(timesheets, new Set(), [])).toEqual([]);
  });
});
