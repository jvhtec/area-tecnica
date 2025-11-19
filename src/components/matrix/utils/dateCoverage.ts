export interface TimesheetCoverageRow {
  job_id: string;
  technician_id: string;
  date?: string;
}

export interface AssignmentMetaRow {
  job_id: string | null;
  technician_id: string | null;
  status: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}

export interface RequiredRoleRow {
  job_id: string | null;
  department: string | null;
  roles: Array<{
    role_code?: string | null;
    quantity?: number | null;
  }> | null;
}

export interface DateCoverageSummary {
  confirmedCount: number;
  assignedTotal: number;
  roleCounts: Record<string, number>;
}

export const EMPTY_DATE_COVERAGE_SUMMARY: DateCoverageSummary = {
  confirmedCount: 0,
  assignedTotal: 0,
  roleCounts: {},
};

const ROLE_DEPARTMENT_MAP: Record<string, 'sound' | 'lights' | 'video'> = {
  sound_role: 'sound',
  lights_role: 'lights',
  video_role: 'video',
};

const normalizeRoleValue = (value?: string | null) => (value ?? '').toString().trim();

export const buildRoleCountKey = (jobId: string, department: string, roleCode: string) =>
  `${jobId}:${department}:${roleCode}`;

export function summarizeDateCoverage(
  timesheetRows: TimesheetCoverageRow[] = [],
  assignmentRows: AssignmentMetaRow[] = []
): DateCoverageSummary {
  if (!timesheetRows.length || !assignmentRows.length) {
    return EMPTY_DATE_COVERAGE_SUMMARY;
  }

  const assignmentMap = new Map<string, AssignmentMetaRow>();
  assignmentRows.forEach((assignment) => {
    if (!assignment?.job_id || !assignment?.technician_id) return;
    assignmentMap.set(`${assignment.job_id}:${assignment.technician_id}`, assignment);
  });

  const confirmedTechIds = new Set<string>();
  const roleCounts = new Map<string, number>();

  const incrementRole = (jobId: string, department: string, rawRole?: string | null) => {
    const roleCode = normalizeRoleValue(rawRole);
    if (!roleCode) return;
    const key = buildRoleCountKey(jobId, department, roleCode);
    roleCounts.set(key, (roleCounts.get(key) || 0) + 1);
  };

  timesheetRows.forEach((row) => {
    if (!row?.job_id || !row?.technician_id) return;
    const assignment = assignmentMap.get(`${row.job_id}:${row.technician_id}`);
    if (!assignment) return;

    const status = (assignment.status ?? '').toString().toLowerCase();
    if (status !== 'confirmed') return;

    confirmedTechIds.add(row.technician_id);

    incrementRole(row.job_id, ROLE_DEPARTMENT_MAP.sound_role, assignment.sound_role);
    incrementRole(row.job_id, ROLE_DEPARTMENT_MAP.lights_role, assignment.lights_role);
    incrementRole(row.job_id, ROLE_DEPARTMENT_MAP.video_role, assignment.video_role);
  });

  const assignedTotal = Array.from(roleCounts.values()).reduce((sum, value) => sum + value, 0);

  return {
    confirmedCount: confirmedTechIds.size,
    assignedTotal,
    roleCounts: Object.fromEntries(roleCounts.entries()),
  };
}

export function calculateOpenSlotTotals(
  requiredRows: RequiredRoleRow[] = [],
  roleCounts: Record<string, number> = {}
) {
  if (!requiredRows.length) {
    return { required: 0, assigned: 0, open: 0 };
  }

  let requiredTotal = 0;
  let assignedTotal = 0;

  requiredRows.forEach((row) => {
    const jobId = row?.job_id;
    const department = row?.department;
    if (!jobId || !department) return;

    const roles = Array.isArray(row?.roles) ? row.roles : [];
    roles.forEach((role) => {
      const quantity = Number(role?.quantity ?? 0);
      if (quantity <= 0) return;
      requiredTotal += quantity;
      const roleCode = normalizeRoleValue(role?.role_code);
      if (!roleCode) return;
      const key = buildRoleCountKey(jobId, department, roleCode);
      const assigned = Math.min(quantity, roleCounts[key] ?? 0);
      assignedTotal += assigned;
    });
  });

  return {
    required: requiredTotal,
    assigned: assignedTotal,
    open: Math.max(requiredTotal - assignedTotal, 0),
  };
}
