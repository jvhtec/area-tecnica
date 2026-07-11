import type { StaffingSummaryRow, StaffingAssignmentRow } from '@/pages/job-assignment-matrix/utils';

export interface CoverageCell {
  required: number;
  filled: number;
}

export interface CoverageRoleBreakdown extends CoverageCell {
  roleCode: string;
}

export interface JobDepartmentCoverage extends CoverageCell {
  roles: CoverageRoleBreakdown[];
}

// job_id -> department -> coverage (with per-role breakdown for the drill-down popover)
export type CoverageByJobDept = Map<string, Map<string, JobDepartmentCoverage>>;

// dateKey (yyyy-MM-dd) -> department -> aggregated coverage across every job that spans that date
export type CoverageByDateDept = Map<string, Map<string, CoverageCell>>;

const ROLE_FIELD_BY_DEPARTMENT: Record<string, keyof StaffingAssignmentRow> = {
  sound: 'sound_role',
  lights: 'lights_role',
  video: 'video_role',
  production: 'production_role',
};

/**
 * Combines required-roles summaries with actual job_assignments into a
 * per-job, per-department, per-role required/filled breakdown. Declined
 * assignments never count as filled.
 */
export function aggregateJobDepartmentCoverage(
  summaries: StaffingSummaryRow[],
  assignments: StaffingAssignmentRow[],
): CoverageByJobDept {
  const filledCounts = new Map<string, number>(); // `${jobId}:${department}:${roleCode}` -> count

  assignments.forEach((row) => {
    if (!row?.job_id) return;
    const status = (row.status || '').toLowerCase();
    if (status === 'declined') return;

    (Object.keys(ROLE_FIELD_BY_DEPARTMENT) as Array<keyof typeof ROLE_FIELD_BY_DEPARTMENT>).forEach((department) => {
      const roleField = ROLE_FIELD_BY_DEPARTMENT[department];
      const roleValue = row[roleField];
      const roleCode = typeof roleValue === 'string' ? roleValue.trim() : '';
      if (!roleCode || roleCode.toLowerCase() === 'none') return;
      const key = `${row.job_id}:${department}:${roleCode}`;
      filledCounts.set(key, (filledCounts.get(key) || 0) + 1);
    });
  });

  const result: CoverageByJobDept = new Map();

  summaries.forEach((summary) => {
    if (!summary?.job_id || !summary?.department) return;
    const roles: CoverageRoleBreakdown[] = summary.roles.map((role) => {
      const required = Number(role.quantity || 0);
      const filled = filledCounts.get(`${summary.job_id}:${summary.department}:${role.role_code}`) || 0;
      return { roleCode: role.role_code, required, filled };
    });

    const required = roles.reduce((sum, role) => sum + role.required, 0);
    const filled = roles.reduce((sum, role) => sum + Math.min(role.filled, role.required || role.filled), 0);

    if (!result.has(summary.job_id)) result.set(summary.job_id, new Map());
    result.get(summary.job_id)!.set(summary.department, { required, filled, roles });
  });

  return result;
}

/**
 * Buckets per-job coverage onto every date a job spans, summing required and
 * filled counts across jobs that share a date + department. A job's
 * requirement counts once per date it spans by design (this answers "what's
 * open *that day*", not a job-lifetime total).
 */
export function aggregateCoverageByDate(
  dateKeys: string[],
  jobsForDateKey: (dateKey: string) => Array<{ id: string }>,
  coverageByJob: CoverageByJobDept,
): CoverageByDateDept {
  const result: CoverageByDateDept = new Map();

  dateKeys.forEach((dateKey) => {
    const jobs = jobsForDateKey(dateKey);
    if (!jobs.length) return;

    const deptMap = new Map<string, CoverageCell>();
    jobs.forEach((job) => {
      const jobCoverage = coverageByJob.get(job.id);
      if (!jobCoverage) return;
      jobCoverage.forEach((cell, department) => {
        if (cell.required === 0) return;
        const existing = deptMap.get(department) || { required: 0, filled: 0 };
        deptMap.set(department, {
          required: existing.required + cell.required,
          filled: existing.filled + cell.filled,
        });
      });
    });

    if (deptMap.size > 0) result.set(dateKey, deptMap);
  });

  return result;
}

export type CoverageStatus = 'complete' | 'partial' | 'empty' | 'none';

export function coverageStatus(cell: CoverageCell | undefined): CoverageStatus {
  if (!cell || cell.required === 0) return 'none';
  if (cell.filled >= cell.required) return 'complete';
  if (cell.filled === 0) return 'empty';
  return 'partial';
}
