import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TourJobRateQuote } from '@/types/tourRates';

export function useTourJobRateQuotes(jobId?: string) {
  return useQuery({
    queryKey: ['tour-job-rate-quotes', jobId],
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      const query = supabase
        .from('v_tour_job_rate_quotes_2025')
        .select('*');
        
      if (jobId) {
        query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useTechnicianTourRateQuotes() {
  return useQuery({
    queryKey: ['technician-tour-rate-quotes'],
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      const { data, error } = await supabase
        .from('v_tour_job_rate_quotes_2025')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}