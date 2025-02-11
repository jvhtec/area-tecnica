
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useFolderExistence = (jobId?: string, tourDateId?: string) => {
  return useQuery({
    queryKey: ["flex-folders", jobId, tourDateId],
    queryFn: async () => {
      if (!jobId && !tourDateId) return false;

      const query = supabase.from("flex_folders").select("id");
      
      if (jobId) {
        query.eq("job_id", jobId);
      }
      
      if (tourDateId) {
        query.eq("tour_date_id", tourDateId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data?.length > 0;
    },
    enabled: !!jobId || !!tourDateId,
  });
};
