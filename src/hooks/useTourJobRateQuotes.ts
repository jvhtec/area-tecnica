import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TourJobRateQuote {
  job_id: string;
  technician_id: string;
  start_time: string;
  end_time: string;
  job_type: string;
  tour_id: string;
  title: string;
  is_house_tech: boolean;
  category: string;
  base_day_eur: number;
  week_count: number;
  multiplier: number;
  iso_year: number;
  iso_week: number;
  total_eur: number;
  breakdown: any;
}

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