import type {
  StaffingAssignmentRow,
  StaffingScheduledRow,
  StaffingSummaryRow,
} from '@/pages/job-assignment-matrix/utils';

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

export type CoverageByJobDept = Map<string, Map<string, JobDepartmentCoverage>>;
export type CoverageByDateDept = Map<string, Map<string, CoverageCell>>;
export type CoverageByDateJobDept = Map<string, CoverageByJobDept>;

const ROLE_FIELD_BY_DEPARTMENT = {
  sound: 'sound_role',
  lights: 'lights_role',
  video: 'video_role',
  production: 'production_role',
} as const satisfies Record<string, keyof StaffingAssignmentRow>;

const assignmentPairKey = (jobId: string, technicianId: string) => `${jobId}:${technicianId}`;

/** Required roles versus technicians with an active scheduled timesheet. */
export function aggregateJobDepartmentCoverage(
  summaries: StaffingSummaryRow[],
  assignments: StaffingAssignmentRow[],
  scheduledPairs?: Set<string>,
): CoverageByJobDept {
  const filledCounts = new Map<string, number>();
  const filledTotals = new Map<string, number>();

  assignments.forEach((row) => {
    if (!row?.job_id || !row.technician_id) return;
    if (scheduledPairs && !scheduledPairs.has(assignmentPairKey(row.job_id, row.technician_id))) return;
    const status = (row.status || '').toLowerCase();
    if (status === 'declined') return;

    Object.entries(ROLE_FIELD_BY_DEPARTMENT).forEach(([department, roleField]) => {
      const roleValue = row[roleField];
      const roleCode = typeof roleValue === 'string' ? roleValue.trim() : '';
      if (!roleCode || roleCode.toLowerCase() === 'none') return;
      const departmentKey = `${row.job_id}:${department}`;
      const key = `${row.job_id}:${department}:${roleCode}`;
      filledTotals.set(departmentKey, (filledTotals.get(departmentKey) || 0) + 1);
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
    // The headline numerator is scheduled headcount, not only technicians
    // whose role happens to match a configured requirement. Role-level
    // matching remains available in the breakdown for staffing decisions.
    const filled = filledTotals.get(`${summary.job_id}:${summary.department}`) || 0;
    if (!result.has(summary.job_id)) result.set(summary.job_id, new Map());
    result.get(summary.job_id)!.set(summary.department, { required, filled, roles });
  });

  // Keep scheduled assignments visible even when a job has no required-role
  // configuration. Otherwise the lens silently undercounts actual crew.
  filledTotals.forEach((filled, key) => {
    const separator = key.lastIndexOf(':');
    const jobId = key.slice(0, separator);
    const department = key.slice(separator + 1);
    if (!result.has(jobId)) result.set(jobId, new Map());
    const departments = result.get(jobId)!;
    if (!departments.has(department)) {
      departments.set(department, { required: 0, filled, roles: [] });
    }
  });

  return result;
}

/** Builds date-specific job coverage, intersected with active timesheets on that exact date. */
export function aggregateCoverageByDateJob(
  dateKeys: string[],
  jobsForDateKey: (dateKey: string) => Array<{ id: string }>,
  summaries: StaffingSummaryRow[],
  assignments: StaffingAssignmentRow[],
  scheduled: StaffingScheduledRow[],
): CoverageByDateJobDept {
  const result: CoverageByDateJobDept = new Map();

  dateKeys.forEach((dateKey) => {
    const jobIds = new Set(jobsForDateKey(dateKey).map((job) => job.id));
    if (jobIds.size === 0) return;
    const scheduledPairs = new Set(
      scheduled
        .filter((row) => row.date === dateKey && jobIds.has(row.job_id))
        .map((row) => assignmentPairKey(row.job_id, row.technician_id)),
    );
    const dateSummaries = summaries.filter((row) => jobIds.has(row.job_id));
    const dateAssignments = assignments.filter((row) => jobIds.has(row.job_id));
    result.set(dateKey, aggregateJobDepartmentCoverage(dateSummaries, dateAssignments, scheduledPairs));
  });

  return result;
}

/** Aggregates date-specific job coverage into the compact date header cells. */
export function aggregateCoverageByDate(
  dateKeys: string[],
  jobsForDateKey: (dateKey: string) => Array<{ id: string }>,
  coverageByDateJob: CoverageByDateJobDept,
): CoverageByDateDept {
  const result: CoverageByDateDept = new Map();

  dateKeys.forEach((dateKey) => {
    const jobCoverageForDate = coverageByDateJob.get(dateKey);
    if (!jobCoverageForDate) return;
    const deptMap = new Map<string, CoverageCell>();

    jobsForDateKey(dateKey).forEach((job) => {
      const jobCoverage = jobCoverageForDate.get(job.id);
      if (!jobCoverage) return;
      jobCoverage.forEach((cell, department) => {
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
