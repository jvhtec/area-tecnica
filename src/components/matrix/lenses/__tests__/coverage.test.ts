import { describe, expect, it } from 'vitest';
import { aggregateCoverageByDate, aggregateJobDepartmentCoverage, coverageStatus } from '../coverage';
import type { StaffingAssignmentRow, StaffingSummaryRow } from '@/pages/job-assignment-matrix/utils';

describe('aggregateJobDepartmentCoverage', () => {
  it('counts filled roles per job/department, ignoring declined assignments', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }, { role_code: 'mon', quantity: 1 }] },
    ];
    const assignments: StaffingAssignmentRow[] = [
      { job_id: 'job-1', sound_role: 'foh', lights_role: null, video_role: null, production_role: null, status: 'confirmed' },
      { job_id: 'job-1', sound_role: 'mon', lights_role: null, video_role: null, production_role: null, status: 'declined' },
    ];

    const result = aggregateJobDepartmentCoverage(summaries, assignments);
    const sound = result.get('job-1')?.get('sound');
    expect(sound?.required).toBe(2);
    expect(sound?.filled).toBe(1);
    expect(sound?.roles.find((r) => r.roleCode === 'foh')?.filled).toBe(1);
    expect(sound?.roles.find((r) => r.roleCode === 'mon')?.filled).toBe(0);
  });

  it('treats "none" role values as unfilled', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    const assignments: StaffingAssignmentRow[] = [
      { job_id: 'job-1', sound_role: 'none', lights_role: null, video_role: null, production_role: null, status: 'confirmed' },
    ];

    const result = aggregateJobDepartmentCoverage(summaries, assignments);
    expect(result.get('job-1')?.get('sound')?.filled).toBe(0);
  });

  it('skips jobs with no required-roles summary', () => {
    const result = aggregateJobDepartmentCoverage([], [
      { job_id: 'job-1', sound_role: 'foh', lights_role: null, video_role: null, production_role: null, status: 'confirmed' },
    ]);
    expect(result.size).toBe(0);
  });
});

describe('aggregateCoverageByDate', () => {
  it('sums required/filled across multiple jobs sharing a date and department', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 2 }] },
      { job_id: 'job-2', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    const assignments: StaffingAssignmentRow[] = [
      { job_id: 'job-1', sound_role: 'foh', lights_role: null, video_role: null, production_role: null, status: 'confirmed' },
    ];
    const coverageByJob = aggregateJobDepartmentCoverage(summaries, assignments);

    const jobsForDateKey = (key: string) => (key === '2026-07-15' ? [{ id: 'job-1' }, { id: 'job-2' }] : []);
    const byDate = aggregateCoverageByDate(['2026-07-15'], jobsForDateKey, coverageByJob);

    const soundCell = byDate.get('2026-07-15')?.get('sound');
    expect(soundCell?.required).toBe(3); // 2 + 1
    expect(soundCell?.filled).toBe(1); // capped: only job-1's foh got filled
  });

  it('counts a job once per date it spans, not once total', () => {
    const summaries: StaffingSummaryRow[] = [
      { job_id: 'job-1', department: 'sound', roles: [{ role_code: 'foh', quantity: 1 }] },
    ];
    const coverageByJob = aggregateJobDepartmentCoverage(summaries, []);
    const jobsForDateKey = () => [{ id: 'job-1' }];

    const byDate = aggregateCoverageByDate(['2026-07-15', '2026-07-16'], jobsForDateKey, coverageByJob);

    expect(byDate.get('2026-07-15')?.get('sound')?.required).toBe(1);
    expect(byDate.get('2026-07-16')?.get('sound')?.required).toBe(1);
  });

  it('omits dates with no jobs or no non-zero requirements', () => {
    const byDate = aggregateCoverageByDate(['2026-07-15'], () => [], new Map());
    expect(byDate.has('2026-07-15')).toBe(false);
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
