
import { supabase } from "@/lib/supabase";

export const deleteJobDepartments = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('job_departments')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error("Error deleting job departments:", error);
      throw error;
    }

    console.log(`Job departments deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting job departments for job ${jobId}:`, error);
    throw error;
  }
};
