
import { supabase } from "@/lib/supabase";

export const deleteJobAssignments = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error("Error deleting job assignments:", error);
      throw error;
    }

    console.log(`Job assignments deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting job assignments for job ${jobId}:`, error);
    throw error;
  }
};
