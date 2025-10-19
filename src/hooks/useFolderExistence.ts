
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useFolderExistence = (jobId: string) => {
  return useQuery({
    queryKey: ["folder-existence", jobId],
    queryFn: async () => {
      console.log("useFolderExistence: Checking folder existence for job:", jobId);
      
      // First, get the job to find its tour_date_id
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, tour_date_id")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) {
        console.error("useFolderExistence: Error fetching job:", jobError);
        throw jobError;
      }

      if (!jobData) {
        console.log("useFolderExistence: Job not found:", jobId);
        return false;
      }

      // Check for folders by job_id OR tour_date_id
      let query = supabase
        .from("flex_folders")
        .select("id")
        .limit(1);

      if (jobData.tour_date_id) {
        // For tour date jobs, check both job_id and tour_date_id
        query = query.or(`job_id.eq.${jobId},tour_date_id.eq.${jobData.tour_date_id}`);
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
      console.log("useFolderExistence: Folder existence result for job", jobId, ":", exists);
      
      return exists;
    },
    enabled: !!jobId,
    staleTime: 1000 * 30, // 30 seconds instead of 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
    retry: 1
  });
};
