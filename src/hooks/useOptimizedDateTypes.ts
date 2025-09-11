import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Optimized hook for fetching date types with aggressive caching
 */
export const useOptimizedDateTypes = (jobIds: string[], dates: string[]) => {
  return useQuery({
    queryKey: ['date-types', jobIds.sort(), dates.sort()],
    queryFn: async () => {
      if (!jobIds.length || !dates.length) {
        return {};
      }

      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .in("job_id", jobIds)
        .in("date", dates);

      if (error) {
        console.error("Error fetching date types:", error);
        throw error;
      }

      return data.reduce((acc: Record<string, any>, curr) => ({
        ...acc,
        [`${curr.job_id}-${curr.date}`]: curr,
      }), {});
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - date types don't change often
    gcTime: 1000 * 60 * 30, // 30 minutes cache
    enabled: jobIds.length > 0 && dates.length > 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};