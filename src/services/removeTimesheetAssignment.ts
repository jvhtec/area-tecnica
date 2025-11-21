import { supabase } from '@/lib/supabase';

interface RemoveTimesheetAssignmentParams {
  jobId: string;
  technicianId: string;
}

interface RemoveTimesheetAssignmentResult {
  deleted_timesheets: number;
  deleted_assignment: boolean;
}

export async function removeTimesheetAssignment({
  jobId,
  technicianId
}: RemoveTimesheetAssignmentParams): Promise<RemoveTimesheetAssignmentResult> {
  const { data, error } = await supabase.rpc('remove_assignment_with_timesheets', {
    p_job_id: jobId,
    p_technician_id: technicianId
  });

  if (error) {
    console.error('Error removing timesheet assignment:', error);
    throw error;
  }

  // The function returns a table with one row
  const result = Array.isArray(data) ? data[0] : data;
  return {
    deleted_timesheets: result?.deleted_timesheets ?? 0,
    deleted_assignment: result?.deleted_assignment ?? false
  };
}
