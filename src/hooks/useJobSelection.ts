
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Job {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  tour_id: string | null;
  tours: {
    name: string;
  } | null;
}

export interface JobSelection {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  tour_id: string | null;
  tours: {
    name: string;
  } | null;
}

export const useJobSelection = () => {
  const { data, isLoading } = useQuery({
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
      return (data || []) as Job[];
    },
  });

  return { jobs: data || [], isLoading };
};
