import { describe, expect, it } from 'vitest';

import { getScheduledWorkDateKeys, normalizeDateKey, resolveAssignmentWorkDateKeys } from '@/utils/assignmentWorkDates';

describe('assignment work date resolution', () => {
  it('normalizes timestamp values using the Madrid calendar day', () => {
    expect(normalizeDateKey('2026-06-01T22:30:00Z')).toBe('2026-06-02');
    expect(normalizeDateKey('2026-06-01')).toBe('2026-06-01');
  });

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

  it('uses tour date ranges when legacy job date types only contain one day', () => {
    expect(getScheduledWorkDateKeys({
      start_time: '2026-05-20T06:00:00',
      end_time: '2026-05-21T21:59:59',
      job_date_types: [
        { date: '2026-05-21', type: 'show' },
      ],
      tour_date: {
        date: '2026-05-20',
        start_date: '2026-05-20',
        end_date: '2026-05-21',
        tour_date_type: 'show',
      },
    })).toEqual(['2026-05-20', '2026-05-21']);
  });

  it('does not re-add explicit non-working job date types from the tour date fallback', () => {
    expect(getScheduledWorkDateKeys({
      job_date_types: [
        { date: '2026-05-20', type: 'travel' },
        { date: '2026-05-21', type: 'show' },
      ],
      tour_date: {
        date: '2026-05-20',
        start_date: '2026-05-20',
        end_date: '2026-05-21',
        tour_date_type: 'show',
      },
    })).toEqual(['2026-05-21']);
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

  it('uses scheduled dates for full multi-day tour assignments when timesheets are unavailable', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        single_day: false,
        assignment_date: null,
        _timesheet_dates: [],
      },
      { scheduledDateKeys: ['2026-06-02', '2026-06-03', '2026-06-04'] },
    )).toEqual(['2026-06-02', '2026-06-03', '2026-06-04']);
  });

  it('prefers active timesheet dates over scheduled dates for tour assignments', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        assignment_source: 'tour',
        single_day: true,
        assignment_date: '2026-05-21',
        _timesheet_dates: ['2026-05-20', '2026-05-21'],
      },
      { scheduledDateKeys: ['2026-05-20', '2026-05-21', '2026-05-22'] },
    )).toEqual(['2026-05-20', '2026-05-21']);
  });

  it('uses scheduled dates for tour-sourced assignments even when the row still says single-day', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        assignment_source: 'tour',
        single_day: true,
        assignment_date: '2026-05-21',
        _timesheet_dates: [],
      },
      { scheduledDateKeys: ['2026-05-20', '2026-05-21'] },
    )).toEqual(['2026-05-20', '2026-05-21']);
  });

  it('does not expand direct single-day assignments to the full job schedule', () => {
    expect(resolveAssignmentWorkDateKeys(
      {
        assignment_source: 'direct',
        single_day: true,
        assignment_date: '2026-05-21',
        _timesheet_dates: [],
      },
      { scheduledDateKeys: ['2026-05-20', '2026-05-21'] },
    )).toEqual(['2026-05-21']);
  });

  it('falls back to the assignment date for legacy single-day rows without timesheets', () => {
    expect(resolveAssignmentWorkDateKeys({
      single_day: true,
      assignment_date: '2026-06-02',
      _timesheet_dates: [],
    })).toEqual(['2026-06-02']);
  });
});
