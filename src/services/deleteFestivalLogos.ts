
import { supabase } from "@/lib/supabase";

export const deleteFestivalLogos = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('festival_logos')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error("Error deleting festival logos:", error);
      throw error;
    }

    console.log(`Festival logos deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting festival logos for job ${jobId}:`, error);
    throw error;
  }
};
