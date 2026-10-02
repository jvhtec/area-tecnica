import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type DateType = { date?: string | null; type?: string | null };
type TourDate = { date?: string | null; start_date?: string | null; end_date?: string | null; tour_date_type?: string | null; type?: string | null };
export type StaffingJobSchedule = {
  start_time?: string | null;
  end_time?: string | null;
  job_date_types?: DateType[] | null;
  tour_date?: TourDate | TourDate[] | null;
};

const madridFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
});

function dateKey(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : madridFormatter.format(date);
}

function range(start?: string | null, end?: string | null): string[] {
  const first = dateKey(start);
  const last = dateKey(end) ?? first;
  if (!first || !last) return [];
  const result: string[] = [];
  const cursor = new Date(`${first}T00:00:00Z`);
  do {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cursor.toISOString().slice(0, 10) <= last);
  return result;
}

const isWorking = (type?: string | null) => type !== 'off' && type !== 'travel';
const uniqueSorted = (dates: string[]) => [...new Set(dates)].sort();

/** Mirrors the canonical schedule's typed-date/tour-date/span precedence in Madrid. */
export function getStaffingWorkDates(job: StaffingJobSchedule): string[] {
  const typed = (job.job_date_types ?? []).filter(row => dateKey(row.date));
  const tourRows = job.tour_date ? (Array.isArray(job.tour_date) ? job.tour_date : [job.tour_date]) : [];
  const tourDates = tourRows.filter(row => isWorking(row.tour_date_type ?? row.type))
    .flatMap(row => range(row.start_date ?? row.date, row.end_date ?? row.date ?? row.start_date));
  if (typed.length > 0) {
    const excluded = new Set(typed.filter(row => !isWorking(row.type)).map(row => dateKey(row.date)));
    return uniqueSorted([
      ...typed.filter(row => isWorking(row.type)).map(row => dateKey(row.date)!),
      ...tourDates.filter(date => !excluded.has(date)),
    ]);
  }
  return tourDates.length > 0 ? uniqueSorted(tourDates) : range(job.start_time, job.end_time);
}

/** Caller supplies only dates backed by confirmed membership and active timesheets. */
export function getUncoveredStaffingWorkDates(job: StaffingJobSchedule, confirmedDates: string[]): string[] {
  const covered = new Set(confirmedDates);
  return getStaffingWorkDates(job).filter(date => !covered.has(date));
}

export async function resolveNewStaffingDates(client: SupabaseClient, jobId: string, profileId: string, job: StaffingJobSchedule, explicitDates: string[], targetDate: string | null): Promise<string[]> {
  if (explicitDates.length > 0) return explicitDates;
  if (targetDate) return [targetDate];
  const { data: membership, error: membershipError } = await client.from('job_assignments')
    .select('job_id').eq('job_id', jobId).eq('technician_id', profileId).eq('status', 'confirmed').maybeSingle();
  if (membershipError) throw new Error('Unable to verify confirmed staffing coverage');
  if (!membership) return getStaffingWorkDates(job);
  const { data: timesheets, error } = await client.from('timesheets')
    .select('date').eq('job_id', jobId).eq('technician_id', profileId).eq('is_active', true);
  if (error) throw new Error('Unable to verify active staffing coverage');
  return getUncoveredStaffingWorkDates(job, (timesheets ?? []).map((row: { date: string }) => row.date));
}
