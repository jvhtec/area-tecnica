import { describe, expect, it } from 'vitest';
import { buildJobAssignmentsFromTimesheets, TimesheetAssignmentRow } from '../morningSummaryUtils';

describe('buildJobAssignmentsFromTimesheets', () => {
  const baseRows: TimesheetAssignmentRow[] = [
    {
      job_id: 'job-1',
      job: { id: 'job-1', title: 'Festival' },
      profile: { id: 'tech-1', nickname: 'Alex' },
    },
    {
      job_id: 'job-1',
      job: { id: 'job-1', title: 'Festival' },
      profile: { id: 'tech-2', nickname: 'Bea' },
    },
    {
      job_id: 'job-1',
      job: { id: 'job-1', title: 'Festival' },
      profile: { id: 'tech-1', nickname: 'Alex' },
    },
  ];

  it('groups technicians per job title without duplicates', () => {
    const result = buildJobAssignmentsFromTimesheets(baseRows);
    expect(result).toEqual([
      { job_title: 'Festival', techs: ['Alex', 'Bea'] },
    ]);
  });

  it('removes a technician from the inspected day without affecting other days', () => {
    const dayOneRows: TimesheetAssignmentRow[] = [
      {
        job_id: 'job-1',
        job: { id: 'job-1', title: 'Festival' },
        profile: { id: 'tech-1', nickname: 'Alex' },
      },
      {
        job_id: 'job-1',
        job: { id: 'job-1', title: 'Festival' },
        profile: { id: 'tech-2', nickname: 'Bea' },
      },
    ];

    const dayTwoRows: TimesheetAssignmentRow[] = [
      {
        job_id: 'job-1',
        job: { id: 'job-1', title: 'Festival' },
        profile: { id: 'tech-1', nickname: 'Alex' },
      },
    ];

    const summaryDayOne = buildJobAssignmentsFromTimesheets(dayOneRows);
    expect(summaryDayOne[0].techs).toEqual(['Alex', 'Bea']);

    const summaryDayOneAfterRemoval = buildJobAssignmentsFromTimesheets(
      dayOneRows.filter((row) => row.profile?.id !== 'tech-1')
    );
    expect(summaryDayOneAfterRemoval[0].techs).toEqual(['Bea']);

    const summaryDayTwo = buildJobAssignmentsFromTimesheets(dayTwoRows);
    expect(summaryDayTwo[0].techs).toEqual(['Alex']);
  });
});
