export type TimesheetAssignmentRow = {
  job_id?: string;
  job?: {
    id?: string;
    title?: string | null;
  } | null;
  profile?: {
    id?: string;
    first_name?: string | null;
    nickname?: string | null;
  } | null;
};

export type MorningSummaryAssignment = {
  job_title: string;
  techs: string[];
};

const FALLBACK_JOB_TITLE = 'Trabajo sin título';
const FALLBACK_TECH_NAME = 'Técnico';

export function buildJobAssignmentsFromTimesheets(
  rows: TimesheetAssignmentRow[]
): MorningSummaryAssignment[] {
  const groups = new Map<string, MorningSummaryAssignment>();

  for (const row of rows) {
    if (!row) continue;
    const jobTitle = row.job?.title || FALLBACK_JOB_TITLE;
    const techName = row.profile?.nickname || row.profile?.first_name || FALLBACK_TECH_NAME;
    const key = row.job_id || row.job?.id || jobTitle;

    if (!groups.has(key)) {
      groups.set(key, { job_title: jobTitle, techs: [] });
    }

    const entry = groups.get(key)!;
    if (!entry.techs.includes(techName)) {
      entry.techs.push(techName);
    }
  }

  return Array.from(groups.values());
}
