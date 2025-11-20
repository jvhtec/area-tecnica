import { describe, expect, it } from 'vitest';
import {
  calculateOpenSlotTotals,
  summarizeDateCoverage,
  buildRoleCountKey,
  type AssignmentMetaRow,
  type TimesheetCoverageRow,
  type RequiredRoleRow,
} from '../dateCoverage';

describe('summarizeDateCoverage', () => {
  const baseTimesheets: TimesheetCoverageRow[] = [
    { job_id: 'job-1', technician_id: 'tech-1' },
    { job_id: 'job-1', technician_id: 'tech-2' },
    { job_id: 'job-2', technician_id: 'tech-3' },
  ];

  const assignmentRows: AssignmentMetaRow[] = [
    { job_id: 'job-1', technician_id: 'tech-1', status: 'confirmed', sound_role: 'FOH' },
    { job_id: 'job-1', technician_id: 'tech-2', status: 'pending', sound_role: 'Monitores' },
    { job_id: 'job-2', technician_id: 'tech-3', status: 'Confirmed', lights_role: 'Operator' },
  ];

  it('counts only confirmed technicians and aggregates roles', () => {
    const summary = summarizeDateCoverage(baseTimesheets, assignmentRows);

    expect(summary.confirmedCount).toBe(2);
    expect(summary.assignedTotal).toBe(2);
    expect(summary.roleCounts[buildRoleCountKey('job-1', 'sound', 'FOH')]).toBe(1);
    expect(summary.roleCounts[buildRoleCountKey('job-2', 'lights', 'Operator')]).toBe(1);
  });

  it('drops counts when the underlying timesheet row disappears', () => {
    const summary = summarizeDateCoverage(baseTimesheets.slice(0, 1), assignmentRows);

    expect(summary.confirmedCount).toBe(1);
    expect(summary.roleCounts[buildRoleCountKey('job-1', 'sound', 'FOH')]).toBe(1);
    expect(summary.roleCounts[buildRoleCountKey('job-2', 'lights', 'Operator')]).toBeUndefined();
  });
});

describe('calculateOpenSlotTotals', () => {
  const requiredRows: RequiredRoleRow[] = [
    {
      job_id: 'job-1',
      department: 'sound',
      roles: [
        { role_code: 'FOH', quantity: 2 },
      ],
    },
    {
      job_id: 'job-2',
      department: 'lights',
      roles: [
        { role_code: 'Operator', quantity: 1 },
      ],
    },
  ];

  it('computes assigned/open totals from role counts', () => {
    const roleCounts = {
      [buildRoleCountKey('job-1', 'sound', 'FOH')]: 1,
      [buildRoleCountKey('job-2', 'lights', 'Operator')]: 1,
    };

    const totals = calculateOpenSlotTotals(requiredRows, roleCounts);

    expect(totals.required).toBe(3);
    expect(totals.assigned).toBe(2);
    expect(totals.open).toBe(1);
  });

  it('drops the open count to zero when coverage meets the requirement', () => {
    const roleCounts = {
      [buildRoleCountKey('job-1', 'sound', 'FOH')]: 2,
      [buildRoleCountKey('job-2', 'lights', 'Operator')]: 1,
    };

    const totals = calculateOpenSlotTotals(requiredRows, roleCounts);

    expect(totals.required).toBe(3);
    expect(totals.assigned).toBe(3);
    expect(totals.open).toBe(0);
  });
});
