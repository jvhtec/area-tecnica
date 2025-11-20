import { supabase } from '@/lib/supabase';

interface ToggleTimesheetDayParams {
  jobId: string;
  technicianId: string;
  dateIso: string;
  present: boolean;
  source?: string;
}

/**
 * Wraps the toggle_timesheet_day RPC so React components can reliably
 * add or remove a single-day staffing entry without touching job_assignments
 * directly. Errors bubble up to the caller for toast handling.
 */
export async function toggleTimesheetDay({
  jobId,
  technicianId,
  dateIso,
  present,
  source = 'matrix'
}: ToggleTimesheetDayParams) {
  const { error } = await supabase.rpc('toggle_timesheet_day', {
    p_job_id: jobId,
    p_technician_id: technicianId,
    p_date: dateIso,
    p_present: present,
    p_source: source,
  });

  if (error) {
    throw error;
  }
}
