import { supabase } from '@/lib/supabase';

interface RemoveTimesheetAssignmentResult {
  deleted_timesheets: number;
  deleted_assignment: boolean;
}

/**
 * Removes every per-day timesheet row for the technician/job pair and deletes
 * the parent job_assignment when no coverage remains. This mirrors the
 * destructive action triggered from the staffing matrix.
 */
export async function removeTimesheetAssignment(jobId: string, technicianId: string) {
  const { data, error } = await supabase.rpc('remove_assignment_with_timesheets', {
    p_job_id: jobId,
    p_technician_id: technicianId,
  });

  if (error) {
    throw error;
  }

  const payload = (Array.isArray(data) ? data[0] : data) as RemoveTimesheetAssignmentResult | null;

  return {
    deleted_timesheets: payload?.deleted_timesheets ?? 0,
    deleted_assignment: payload?.deleted_assignment ?? false,
  };
}
