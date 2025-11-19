export type WallboardDept = 'sound' | 'lights' | 'video';

export interface WallboardAssignmentRoleRow {
  job_id: string;
  technician_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
}

export interface WallboardTimesheetRow {
  job_id: string;
  technician_id: string;
  date: string;
}

export interface AggregatedCrewData {
  jobDayDeptSets: Map<string, Map<string, Record<WallboardDept, Set<string>>>>;
  jobDeptMinimums: Map<string, Record<WallboardDept, number>>;
  jobTechDates: Map<string, Map<string, Set<string>>>;
  jobTechSets: Map<string, Set<string>>;
}

function createDeptSets(): Record<WallboardDept, Set<string>> {
  return {
    sound: new Set<string>(),
    lights: new Set<string>(),
    video: new Set<string>(),
  };
}

function getDeptFromAssignment(row: WallboardAssignmentRoleRow): WallboardDept | null {
  if (row.sound_role) return 'sound';
  if (row.lights_role) return 'lights';
  if (row.video_role) return 'video';
  return null;
}

export function aggregateCrewFromTimesheets(
  timesheets: WallboardTimesheetRow[],
  assignments: WallboardAssignmentRoleRow[],
  jobDayWindows?: Map<string, string[]>,
): AggregatedCrewData {
  const assignmentsByKey = new Map<string, WallboardAssignmentRoleRow>();
  assignments.forEach((row) => {
    assignmentsByKey.set(`${row.job_id}:${row.technician_id}`, row);
  });

  const jobDayDeptSets = new Map<string, Map<string, Record<WallboardDept, Set<string>>>>();
  const jobTechDates = new Map<string, Map<string, Set<string>>>();
  const jobTechSets = new Map<string, Set<string>>();

  timesheets.forEach((ts) => {
    const assignment = assignmentsByKey.get(`${ts.job_id}:${ts.technician_id}`);
    if (!assignment) return;
    const dept = getDeptFromAssignment(assignment);
    if (!dept) return;

    const dayKey = ts.date;
    const dayMap = jobDayDeptSets.get(ts.job_id) ?? new Map<string, Record<WallboardDept, Set<string>>>();
    const deptSets = dayMap.get(dayKey) ?? createDeptSets();
    deptSets[dept].add(ts.technician_id);
    dayMap.set(dayKey, deptSets);
    jobDayDeptSets.set(ts.job_id, dayMap);

    const techSet = jobTechSets.get(ts.job_id) ?? new Set<string>();
    techSet.add(ts.technician_id);
    jobTechSets.set(ts.job_id, techSet);

    const techDateMap = jobTechDates.get(ts.job_id) ?? new Map<string, Set<string>>();
    const dates = techDateMap.get(ts.technician_id) ?? new Set<string>();
    dates.add(dayKey);
    techDateMap.set(ts.technician_id, dates);
    jobTechDates.set(ts.job_id, techDateMap);
  });

  if (jobDayWindows) {
    jobDayWindows.forEach((dates, jobId) => {
      if (!dates || dates.length === 0) return;
      const dayMap = jobDayDeptSets.get(jobId) ?? new Map<string, Record<WallboardDept, Set<string>>>();
      dates.forEach((isoDate) => {
        if (!dayMap.has(isoDate)) {
          dayMap.set(isoDate, createDeptSets());
        }
      });
      jobDayDeptSets.set(jobId, dayMap);
    });
  }

  const jobDeptMinimums = new Map<string, Record<WallboardDept, number>>();
  jobDayDeptSets.forEach((dayMap, jobId) => {
    const counts: Record<WallboardDept, number> = { sound: 0, lights: 0, video: 0 };
    (['sound', 'lights', 'video'] as const).forEach((dept) => {
      let min: number | null = null;
      dayMap.forEach((deptSets) => {
        const size = deptSets[dept].size;
        if (min === null || size < min) {
          min = size;
        }
      });
      counts[dept] = min ?? 0;
    });
    jobDeptMinimums.set(jobId, counts);
  });

  return {
    jobDayDeptSets,
    jobDeptMinimums,
    jobTechDates,
    jobTechSets,
  };
}
