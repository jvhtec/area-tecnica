
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useJobSelection = () => {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          start_time,
          end_time,
          tour_id,
          tours (
            name
          )
        `)
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  return { jobs, isLoading };
};
