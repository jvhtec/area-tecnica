import { describe, expect, it } from 'vitest';
import {
  aggregateCoverageByDate,
  aggregateCoverageByDateJob,
  aggregateJobDepartmentCoverage,
  coverageStatus,
} from '../coverage';
import type {
  StaffingAssignmentRow,
  StaffingScheduledRow,
  StaffingSummaryRow,
} from '@/pages/job-assignment-matrix/utils';

const assignment = (
  jobId: string,
  technicianId: string,
  role: string,
  status = 'confirmed',
): StaffingAssignmentRow => ({
  job_id: jobId,
  technician_id: technicianId,
  sound_role: role,
  lights_role: null,
  video_role: null,
  production_role: null,
  status,
});

describe('aggregateJobDepartmentCoverage', () => {
  it('counts filled roles per job/department, ignoring declined assignments', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }, { role_code: 'mon', quantity: 1 }] },
    ];
    const assignments = [assignment('job-1', 'tech-1', 'foh'), assignment('job-1', 'tech-2', 'mon', 'declined')];

    const sound = aggregateJobDepartmentCoverage(summaries, assignments).get('job-1')?.get('sound');
    expect(sound?.required).toBe(2);
    expect(sound?.filled).toBe(1);
    expect(sound?.roles.find((role) => role.roleCode === 'foh')?.filled).toBe(1);
    expect(sound?.roles.find((role) => role.roleCode === 'mon')?.filled).toBe(0);
  });

  it('counts only technicians present in the supplied scheduled pair set', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 2 }] },
    ];
    const assignments = [assignment('job-1', 'tech-1', 'foh'), assignment('job-1', 'tech-2', 'foh')];

    const result = aggregateJobDepartmentCoverage(summaries, assignments, new Set(['job-1:tech-2']));
    expect(result.get('job-1')?.get('sound')?.filled).toBe(1);
  });

  it('shows actual overstaffing instead of capping filled at required', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    const assignments = [
      assignment('job-1', 'tech-1', 'foh'),
      assignment('job-1', 'tech-2', 'foh'),
      assignment('job-1', 'tech-3', 'foh'),
    ];

    const result = aggregateJobDepartmentCoverage(summaries, assignments);
    expect(result.get('job-1')?.get('sound')).toEqual(expect.objectContaining({ required: 1, filled: 3 }));
  });

  it('treats "none" role values as unfilled', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    expect(aggregateJobDepartmentCoverage(summaries, [assignment('job-1', 'tech-1', 'none')]).get('job-1')?.get('sound')?.filled).toBe(0);
  });

  it('counts scheduled crew even when the job has no required-roles summary', () => {
    expect(aggregateJobDepartmentCoverage([], [assignment('job-1', 'tech-1', 'foh')]).get('job-1')?.get('sound'))
      .toEqual({ required: 0, filled: 1, roles: [] });
  });

  it('includes assigned headcount whose role is not part of the configured demand', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    const result = aggregateJobDepartmentCoverage(summaries, [assignment('job-1', 'tech-1', 'mon')]);

    expect(result.get('job-1')?.get('sound')).toEqual({
      required: 1,
      filled: 1,
      roles: [{ roleCode: 'foh', required: 1, filled: 0 }],
    });
  });
});

describe('date-specific coverage', () => {
  const summaries: StaffingSummaryRow[] = [
    { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 2 }] },
    { job_id: 'job-2', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
  ];
  const assignments = [assignment('job-1', 'tech-1', 'foh'), assignment('job-1', 'tech-2', 'foh')];
  const jobsForDateKey = (key: string) => (key.startsWith('2026-07-') ? [{ id: 'job-1' }, { id: 'job-2' }] : []);

  it('does not carry a single-day assignment onto every date in a multi-day job', () => {
    const scheduled: StaffingScheduledRow[] = [
      { job_id: 'job-1', technician_id: 'tech-1', date: '2026-07-15' },
      { job_id: 'job-1', technician_id: 'tech-2', date: '2026-07-16' },
    ];
    const dateKeys = ['2026-07-15', '2026-07-16'];
    const byDateJob = aggregateCoverageByDateJob(dateKeys, jobsForDateKey, summaries, assignments, scheduled);
    const byDate = aggregateCoverageByDate(dateKeys, jobsForDateKey, byDateJob);

    expect(byDate.get('2026-07-15')?.get('sound')).toEqual({ required: 3, filled: 1 });
    expect(byDate.get('2026-07-16')?.get('sound')).toEqual({ required: 3, filled: 1 });
    expect(byDateJob.get('2026-07-15')?.get('job-1')?.get('sound')?.filled).toBe(1);
    expect(byDateJob.get('2026-07-16')?.get('job-1')?.get('sound')?.filled).toBe(1);
  });

  it('omits dates with no jobs or requirements', () => {
    const byDateJob = aggregateCoverageByDateJob(['2026-08-01'], () => [], [], [], []);
    expect(aggregateCoverageByDate(['2026-08-01'], () => [], byDateJob).has('2026-08-01')).toBe(false);
  });

  it('includes scheduled crew from jobs without configured demand in the date total', () => {
    const dateKey = '2026-07-09';
    const dateAssignments = [
      assignment('job-1', 'tech-1', 'foh'),
      assignment('job-2', 'tech-2', 'foh'),
    ];
    const scheduled: StaffingScheduledRow[] = dateAssignments.map((row) => ({
      job_id: row.job_id,
      technician_id: row.technician_id,
      date: dateKey,
    }));
    const byDateJob = aggregateCoverageByDateJob(
      [dateKey],
      () => [{ id: 'job-1' }, { id: 'job-2' }],
      [summaries[0]],
      dateAssignments,
      scheduled,
    );

    expect(aggregateCoverageByDate([dateKey], () => [{ id: 'job-1' }, { id: 'job-2' }], byDateJob)
      .get(dateKey)?.get('sound')).toEqual({ required: 2, filled: 2 });
    expect(byDateJob.get(dateKey)?.get('job-2')?.get('sound')).toEqual({ required: 0, filled: 1, roles: [] });
  });
});

describe('coverageStatus', () => {
  it('classifies complete, partial, empty, and none', () => {
    expect(coverageStatus(undefined)).toBe('none');
    expect(coverageStatus({ required: 0, filled: 0 })).toBe('none');
    expect(coverageStatus({ required: 2, filled: 2 })).toBe('complete');
    expect(coverageStatus({ required: 2, filled: 1 })).toBe('partial');
    expect(coverageStatus({ required: 2, filled: 0 })).toBe('empty');
  });
});
