export type Dept = 'sound' | 'lights' | 'video';

export interface TimesheetCrewRow {
  technician_id: string | null;
  date?: string | null;
  job_assignments?:
    | {
        sound_role?: string | null;
        lights_role?: string | null;
        video_role?: string | null;
      }
    | Array<{
        sound_role?: string | null;
        lights_role?: string | null;
        video_role?: string | null;
      }>
    | null;
  profile?:
    | {
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
      }
    | Array<{
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
      }>
    | null;
}

const deptKeyMap: Record<Dept, 'sound_role' | 'lights_role' | 'video_role'> = {
  sound: 'sound_role',
  lights: 'lights_role',
  video: 'video_role',
};

function extractAssignment(row: TimesheetCrewRow) {
  if (!row.job_assignments) return null;
  return Array.isArray(row.job_assignments) ? row.job_assignments[0] ?? null : row.job_assignments;
}

export function selectTimesheetCrew(rows: TimesheetCrewRow[], department: Dept): TimesheetCrewRow[] {
  const deptKey = deptKeyMap[department];
  const byTech = new Map<string, TimesheetCrewRow>();
  rows.forEach((row) => {
    const techId = row.technician_id;
    if (!techId) return;
    const assignment = extractAssignment(row);
    if (!assignment?.[deptKey]) return;
    if (!byTech.has(techId)) {
      byTech.set(techId, row);
    }
  });
  return Array.from(byTech.values());
}

export function formatCrewName(row: TimesheetCrewRow): string {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const first = profile?.first_name?.trim() || '';
  const last = profile?.last_name?.trim() || '';
  const combined = `${first} ${last}`.trim();
  return combined || 'Técnico';
}

export function getCrewPhone(row: TimesheetCrewRow): string {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  return (profile?.phone || '').trim();
}
