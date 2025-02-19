
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

export const useJobSelection = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['jobs-active'],
    queryFn: async () => {
      const { data: jobsData, error } = await supabase
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
      
      // Ensure the data matches our Job interface
      const typedJobs = (jobsData || []).map(job => ({
        ...job,
        tours: job.tours ? { name: String(job.tours.name) } : null
      })) as Job[];

      return typedJobs;
    },
  });

  return { jobs: data || [], isLoading };
};
