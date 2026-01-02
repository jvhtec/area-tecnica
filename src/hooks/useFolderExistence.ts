
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useFolderExistence = (jobId: string, tourDateId?: string | null) => {
  return useQuery({
    queryKey: ["folder-existence", jobId],
    queryFn: async () => {
      if (import.meta.env.DEV) {
        console.log("useFolderExistence: Checking folder existence for job:", jobId);
      }

      // Check for folders by job_id OR tour_date_id (if provided)
      let query = supabase
        .from("flex_folders")
        .select("id")
        .limit(1);

      if (tourDateId) {
        // For tour date jobs, check both job_id and tour_date_id
        query = query.or(`job_id.eq.${jobId},tour_date_id.eq.${tourDateId}`);
      } else {
        // For regular jobs, only check job_id
        query = query.eq("job_id", jobId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("useFolderExistence: Error checking folder existence:", error);
        throw error;
      }

      const exists = data && data.length > 0;
      if (import.meta.env.DEV) {
        console.log("useFolderExistence: Folder existence result for job", jobId, ":", exists);
      }
      
      return exists;
    },
    enabled: !!jobId,
    staleTime: 1000 * 60 * 10, // 10 minutes - changes are explicit & invalidated
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
};
