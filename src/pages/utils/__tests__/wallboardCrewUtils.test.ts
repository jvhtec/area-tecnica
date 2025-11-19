import { describe, expect, it } from 'vitest';
import { aggregateCrewFromTimesheets, type WallboardAssignmentRoleRow, type WallboardTimesheetRow } from '../wallboardCrewUtils';

describe('aggregateCrewFromTimesheets', () => {
  const assignments: WallboardAssignmentRoleRow[] = [
    { job_id: 'job1', technician_id: 'tech1', sound_role: 'FOH' },
    { job_id: 'job1', technician_id: 'tech2', sound_role: 'MON' },
    { job_id: 'job1', technician_id: 'tech3', lights_role: 'LD' },
  ];

  it('groups per-day coverage and dedupes technicians per department', () => {
    const timesheets: WallboardTimesheetRow[] = [
      { job_id: 'job1', technician_id: 'tech1', date: '2025-05-01' },
      { job_id: 'job1', technician_id: 'tech1', date: '2025-05-02' },
      { job_id: 'job1', technician_id: 'tech2', date: '2025-05-01' },
      { job_id: 'job1', technician_id: 'tech3', date: '2025-05-01' },
      { job_id: 'job1', technician_id: 'tech3', date: '2025-05-02' },
    ];

    const result = aggregateCrewFromTimesheets(timesheets, assignments);
    const dayMap = result.jobDayDeptSets.get('job1');
    expect(dayMap?.get('2025-05-01')?.sound.size).toBe(2);
    expect(dayMap?.get('2025-05-01')?.lights.size).toBe(1);
    expect(dayMap?.get('2025-05-02')?.sound.size).toBe(1);
    expect(dayMap?.get('2025-05-02')?.lights.size).toBe(1);

    const counts = result.jobDeptMinimums.get('job1');
    expect(counts).toEqual({ sound: 1, lights: 1, video: 0 });
  });

  it('drops day-level counts when a timesheet row is removed', () => {
    const initial: WallboardTimesheetRow[] = [
      { job_id: 'job1', technician_id: 'tech1', date: '2025-05-01' },
      { job_id: 'job1', technician_id: 'tech2', date: '2025-05-01' },
    ];
    const aggregated = aggregateCrewFromTimesheets(initial, assignments);
    expect(aggregated.jobDayDeptSets.get('job1')?.get('2025-05-01')?.sound.size).toBe(2);

    const updated: WallboardTimesheetRow[] = [
      { job_id: 'job1', technician_id: 'tech1', date: '2025-05-01' },
    ];
    const afterRemoval = aggregateCrewFromTimesheets(updated, assignments);
    expect(afterRemoval.jobDayDeptSets.get('job1')?.get('2025-05-01')?.sound.size).toBe(1);
    expect(afterRemoval.jobDeptMinimums.get('job1')).toEqual({ sound: 1, lights: 0, video: 0 });
  });

  it('treats missing days as zero coverage when a window is provided', () => {
    const windows = new Map<string, string[]>([[
      'job1',
      ['2025-05-01', '2025-05-02'],
    ]]);
    const singleDay: WallboardTimesheetRow[] = [
      { job_id: 'job1', technician_id: 'tech1', date: '2025-05-01' },
    ];
    const aggregated = aggregateCrewFromTimesheets(singleDay, assignments, windows);
    expect(aggregated.jobDayDeptSets.get('job1')?.get('2025-05-02')?.sound.size).toBe(0);
    expect(aggregated.jobDeptMinimums.get('job1')).toEqual({ sound: 0, lights: 0, video: 0 });
  });
});
