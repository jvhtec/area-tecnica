
import { supabase } from "@/lib/supabase";

export const deleteJobDateTypes = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('job_date_types')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error("Error deleting job date types:", error);
      throw error;
    }

    console.log(`Job date types deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting job date types for job ${jobId}:`, error);
    throw error;
  }
};
