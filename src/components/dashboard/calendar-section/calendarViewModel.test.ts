import { describe, expect, it } from 'vitest';
import {
  buildCalendarDays,
  filterCalendarJobsForDate,
  getCalendarExportInterval,
  prepareCalendarJobs,
} from './calendarViewModel';

describe('calendar view model', () => {
  it('builds a stable six-week Monday-first grid', () => {
    const days = buildCalendarDays(new Date(2026, 6, 15));

    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(1);
    expect(days[41].getDay()).toBe(0);
  });

  it('prepares timezone/department metadata and applies all filters', () => {
    const jobs = prepareCalendarJobs([
      {
        id: 'job-1',
        start_time: '2026-07-22T08:00:00Z',
        end_time: '2026-07-22T18:00:00Z',
        timezone: 'Europe/Madrid',
        job_type: 'festival',
        status: 'confirmed',
        job_departments: [{ department: 'sound' }],
      },
      {
        id: 'job-2',
        start_time: '2026-07-22T08:00:00Z',
        end_time: '2026-07-22T18:00:00Z',
        job_type: 'dryhire',
        status: 'cancelled',
        job_departments: [{ department: 'lights' }],
      },
    ]);

    const result = filterCalendarJobsForDate(jobs, new Date(2026, 6, 22), {
      department: 'sound',
      selectedJobTypes: ['festival'],
      selectedJobStatuses: ['confirmed'],
    });

    expect(result.map((job) => job.id)).toEqual(['job-1']);
    expect(jobs[1].jobTimezone).toBe('Europe/Madrid');
  });

  it('uses the same month, quarter, and year intervals for every export format', () => {
    const currentDate = new Date(2026, 6, 22);

    expect(getCalendarExportInterval('month', currentDate).startDate).toEqual(new Date(2026, 6, 1));
    expect(getCalendarExportInterval('quarter', currentDate).startDate).toEqual(new Date(2026, 6, 1));
    expect(getCalendarExportInterval('year', currentDate).endDate).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });
});
