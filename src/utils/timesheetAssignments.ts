import { differenceInCalendarDays, parseISO } from 'date-fns';

export interface TimesheetRowWithTechnician {
  job_id: string;
  technician_id: string | null;
  date: string;
  technician?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    department?: string | null;
  } | null;
}

export type AssignmentRow = Record<string, any> | null | undefined;

export interface AggregatedTimesheetAssignment extends Record<string, any> {
  job_id: string;
  technician_id: string;
  timesheet_dates: string[];
  timesheet_ranges: Array<{ start: string; end: string }>;
}

function normalizeProfile(profile: any) {
  if (!profile) return profile;
  return Array.isArray(profile) ? profile[0] : profile;
}

export function collapseConsecutiveDates(dates: string[]): Array<{ start: string; end: string }> {
  if (!dates || dates.length === 0) {
    return [];
  }

  const sorted = [...new Set(dates)].sort();
  const ranges: Array<{ start: string; end: string }> = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  const parseDate = (value: string) => {
    try {
      return parseISO(value);
    } catch {
      return null;
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prevDate = parseDate(prev);
    const currentDate = parseDate(current);
    if (!prevDate || !currentDate) {
      ranges.push({ start: rangeStart, end: prev });
      rangeStart = current;
      prev = current;
      continue;
    }

    const diff = differenceInCalendarDays(currentDate, prevDate);
    if (diff === 1) {
      prev = current;
      continue;
    }

    ranges.push({ start: rangeStart, end: prev });
    rangeStart = current;
    prev = current;
  }

  ranges.push({ start: rangeStart, end: prev });
  return ranges;
}

function buildAssignmentLookup(assignmentsByJob: Record<string, AssignmentRow[] | undefined>) {
  const lookup = new Map<string, Map<string, AssignmentRow>>();
  Object.entries(assignmentsByJob).forEach(([jobId, rows]) => {
    if (!rows || rows.length === 0) return;
    const techMap = new Map<string, AssignmentRow>();
    rows.forEach((row) => {
      if (!row || !row.technician_id) return;
      if (!techMap.has(row.technician_id)) {
        techMap.set(row.technician_id, row);
      }
    });
    lookup.set(jobId, techMap);
  });
  return lookup;
}

export function aggregateTimesheetsForJob(
  jobId: string,
  rows: TimesheetRowWithTechnician[],
  assignments: AssignmentRow[] = []
): AggregatedTimesheetAssignment[] {
  if (!jobId) return [];
  const grouped = aggregateJobTimesheets(rows, { [jobId]: assignments });
  return grouped[jobId] || [];
}

export function aggregateJobTimesheets(
  rows: TimesheetRowWithTechnician[],
  assignmentsByJob: Record<string, AssignmentRow[] | undefined> = {}
): Record<string, AggregatedTimesheetAssignment[]> {
  const assignmentLookup = buildAssignmentLookup(assignmentsByJob);
  const grouped = new Map<string, Map<string, TimesheetRowWithTechnician[]>>();

  rows.forEach((row) => {
    if (!row?.job_id || !row?.technician_id) {
      return;
    }
    const jobMap = grouped.get(row.job_id) ?? new Map<string, TimesheetRowWithTechnician[]>();
    const techRows = jobMap.get(row.technician_id) ?? [];
    techRows.push(row);
    jobMap.set(row.technician_id, techRows);
    grouped.set(row.job_id, jobMap);
  });

  const result: Record<string, AggregatedTimesheetAssignment[]> = {};

  grouped.forEach((techMap, jobId) => {
    const assignments = assignmentLookup.get(jobId);
    const aggregated: AggregatedTimesheetAssignment[] = [];

    techMap.forEach((techRows, technicianId) => {
      const sortedDates = [...new Set(techRows.map((row) => row.date).filter(Boolean))].sort();
      const ranges = collapseConsecutiveDates(sortedDates);
      const assignment = assignments?.get(technicianId) ?? null;
      const profile = normalizeProfile(assignment?.profiles ?? techRows[0]?.technician ?? null);
      const merged: AggregatedTimesheetAssignment = {
        ...(assignment ? { ...assignment } : {}),
        job_id: jobId,
        technician_id: technicianId,
        timesheet_dates: sortedDates,
        timesheet_ranges: ranges,
      };
      if (profile) {
        merged.profiles = profile;
      }
      aggregated.push(merged);
    });

    result[jobId] = aggregated;
  });

  return result;
}
