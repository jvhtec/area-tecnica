import { supabase } from "@/lib/supabase";

/**
 * Removes every per-day timesheet row for the provided job so that
 * downstream reports, payroll, and scheduling queries stop surfacing
 * deleted jobs immediately after cleanup runs.
 */
export const deleteJobTimesheets = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('timesheets')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error('Error deleting timesheets:', error);
      throw error;
    }

    console.log(`Timesheets deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting timesheets for job ${jobId}:`, error);
    throw error;
  }
};
