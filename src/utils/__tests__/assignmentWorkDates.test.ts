import { describe, expect, it } from 'vitest';

import { getScheduledWorkDateKeys, resolveAssignmentWorkDateKeys } from '../assignmentWorkDates';

describe('assignment work date resolution', () => {
  it('uses working job date types as the scheduled job span', () => {
    expect(getScheduledWorkDateKeys({
      start_time: '2026-06-01T06:00:00',
      end_time: '2026-06-04T22:00:00',
      job_date_types: [
        { date: '2026-06-01', type: 'travel' },
        { date: '2026-06-02', type: 'show' },
        { date: '2026-06-03', type: 'rehearsal' },
        { date: '2026-06-04', type: 'off' },
      ],
    })).toEqual(['2026-06-02', '2026-06-03']);
  });

  it('keeps exact timesheet days for partial multi-day assignments', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        single_day: true,
        assignment_date: '2026-06-02',
        _timesheet_dates: ['2026-06-04', '2026-06-02'],
      },
      { scheduledDateKeys: ['2026-06-02', '2026-06-03', '2026-06-04'] },
    )).toEqual(['2026-06-02', '2026-06-04']);
  });

  it('uses scheduled dates for full multi-day tour assignments even when old schedule-only timesheets are incomplete', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        single_day: false,
        assignment_date: null,
        _timesheet_dates: ['2026-06-02'],
      },
      { scheduledDateKeys: ['2026-06-02', '2026-06-03', '2026-06-04'] },
    )).toEqual(['2026-06-02', '2026-06-03', '2026-06-04']);
  });

  it('falls back to the assignment date for legacy single-day rows without timesheets', () => {
    expect(resolveAssignmentWorkDateKeys({
      single_day: true,
      assignment_date: '2026-06-02',
      _timesheet_dates: [],
    })).toEqual(['2026-06-02']);
  });
});
