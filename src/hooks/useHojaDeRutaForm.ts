import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useJobSelection } from "./useJobSelection";
import type { HojaDeRutaFormData } from "@/types/hoja-de-ruta";

export const useHojaDeRutaForm = (jobId: string) => {
  const { jobs } = useJobSelection();
  const selectedJob = jobs.find(job => job.id === jobId);

  const { data: formData, isLoading, error } = useQuery({
    queryKey: ['hoja-de-ruta', jobId],
    queryFn: async () => {
      if (!jobId) return null;

      const { data, error } = await supabase
        .from('hojas_de_ruta')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (error) {
        console.error("Error fetching hoja de ruta:", error);
        throw error;
      }

      return data as HojaDeRutaFormData;
    },
    enabled: !!jobId,
  });

  return {
    formData,
    isLoading,
    error,
    selectedJob,
  };
};
