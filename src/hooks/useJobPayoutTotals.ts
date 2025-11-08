import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JobPayoutTotals } from '@/types/jobExtras';

export interface UseJobPayoutTotalsOptions {
  enabled?: boolean;
}

export function useJobPayoutTotals(
  jobId: string,
  technicianId?: string,
  options?: UseJobPayoutTotalsOptions
) {
  return useQuery({
    queryKey: ['job-tech-payout', jobId, technicianId],
    queryFn: async (): Promise<JobPayoutTotals[]> => {
      let query = supabase
        .from('v_job_tech_payout_2025')
        .select('*')
        .eq('job_id', jobId);
      
      if (technicianId) {
        query = query.eq('technician_id', technicianId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        extras_breakdown: item.extras_breakdown as unknown as JobPayoutTotals['extras_breakdown'],
      }));
    },
    enabled: (!!jobId) && (options?.enabled ?? true),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useMyJobPayoutTotals() {
  return useQuery({
    queryKey: ['my-job-payout-totals'],
    queryFn: async (): Promise<JobPayoutTotals[]> => {
      const { data, error } = await supabase
        .from('v_job_tech_payout_2025')
        .select('*')
        .order('job_id');
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        extras_breakdown: item.extras_breakdown as unknown as JobPayoutTotals['extras_breakdown'],
      }));
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}