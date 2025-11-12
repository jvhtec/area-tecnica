import { describe, expect, it } from 'vitest';
import { detectConflictForAssignment, type AssignmentCoverage, type JobTimeInfo } from '../conflictUtils.ts';

const makeDayWindow = (date: string, jobId: number, jobTitle: string | null = null): AssignmentCoverage => {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    window: { kind: 'day', start, end },
    meta: { job_id: jobId, job_title: jobTitle, assignment_date: date },
  };
};

describe('detectConflictForAssignment', () => {
  const jobInfo: JobTimeInfo = {
    title: 'Lighting Gig',
    start: new Date('2024-05-01T08:00:00.000Z'),
    end: new Date('2024-05-03T02:00:00.000Z'),
    rawStart: '2024-05-01T08:00:00.000Z',
    rawEnd: '2024-05-03T02:00:00.000Z',
  };

  it('flags a conflicting single-day assignment while allowing other days to proceed', () => {
    const existingAssignments: AssignmentCoverage[] = [
      makeDayWindow('2024-05-02', 77, 'Soundcheck'),
    ];
    const processed: string[] = [];
    const skipped: string[] = [];
    for (const day of ['2024-05-01', '2024-05-02', '2024-05-03']) {
      const result = detectConflictForAssignment({
        targetDate: day,
        existingAssignmentWindows: existingAssignments,
        jobInfo,
        jobId: 55,
        jobStartTime: jobInfo.rawStart,
        jobEndTime: jobInfo.rawEnd,
      });
      if (result.conflict) {
        skipped.push(day);
      } else {
        processed.push(day);
      }
    }

    expect(skipped).toEqual(['2024-05-02']);
    expect(processed).toEqual(['2024-05-01', '2024-05-03']);
  });

  it('produces detailed conflict metadata when overlap occurs', () => {
    const result = detectConflictForAssignment({
      targetDate: '2024-05-02',
      existingAssignmentWindows: [makeDayWindow('2024-05-02', 99, 'Main Stage')],
      jobInfo,
      jobId: 55,
      jobStartTime: jobInfo.rawStart,
      jobEndTime: jobInfo.rawEnd,
    });

    expect(result.conflict).toBe(true);
    if (result.conflict) {
      expect(result.meta).toMatchObject({
        request_job_id: 55,
        request_single_day: true,
        request_window_type: 'day',
        request_assignment_date: '2024-05-02',
        conflicting_job_id: 99,
        conflicting_job_title: 'Main Stage',
        conflicting_window_type: 'day',
        conflicting_assignment_date: '2024-05-02',
      });
    }
  });
});
