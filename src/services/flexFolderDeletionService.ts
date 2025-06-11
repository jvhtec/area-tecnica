
import { supabase } from "@/lib/supabase";

export const deleteFlexFolders = async (jobId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('flex_folders')
      .delete()
      .eq('job_id', jobId);

    if (error) {
      console.error("Error deleting flex folders:", error);
      throw error;
    }

    console.log(`Flex folders deleted for job ${jobId}`);
  } catch (error) {
    console.error(`Error deleting flex folders for job ${jobId}:`, error);
    throw error;
  }
};
