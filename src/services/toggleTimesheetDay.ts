import { supabase } from '@/lib/supabase';

interface ToggleTimesheetDayParams {
  jobId: string;
  technicianId: string;
  dateIso: string;
  present: boolean;
  source?: string;
}

export async function toggleTimesheetDay({
  jobId,
  technicianId,
  dateIso,
  present,
  source = 'matrix'
}: ToggleTimesheetDayParams): Promise<void> {
  const { error } = await supabase.rpc('toggle_timesheet_day', {
    p_job_id: jobId,
    p_technician_id: technicianId,
    p_date: dateIso,
    p_present: present,
    p_source: source
  });

  if (error) {
    console.error('Error toggling timesheet day:', error);
    throw error;
  }
}
