
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useFolderExistence = (jobId: string) => {
  return useQuery({
    queryKey: ["folder-existence", jobId],
    queryFn: async () => {
      console.log("useFolderExistence: Checking folder existence for job:", jobId);
      
      const { data, error } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", jobId)
        .limit(1);

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
