import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobTotals {
  job_id: string;
  total_approved_eur: number;
  total_pending_eur: number;
  breakdown_by_category: Record<string, {
    count: number;
    total_eur: number;
    individual_entries: Array<{
      technician_name: string;
      amount_eur: number;
      date: string;
    }>;
  }>;
  individual_amounts: Array<{
    technician_name: string;
    category: string;
    amount_eur: number;
    date: string;
  }>;
  user_can_see_all: boolean;
}

export function useJobTotals(jobId: string) {
  return useQuery({
    queryKey: ['job-totals', jobId],
    queryFn: async (): Promise<JobTotals | null> => {
      if (!jobId) return null;

      const { data, error } = await supabase.rpc('get_job_total_amounts', {
        _job_id: jobId
      });

      if (error) throw error;
      
      // The RPC returns a single row
      const result = Array.isArray(data) ? data[0] : data;
      return result as JobTotals;
    },
    enabled: !!jobId,
    staleTime: 30 * 1000, // 30 seconds
  });
}