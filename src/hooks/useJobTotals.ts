import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobTotals {
  job_id: string;
  total_approved_eur: number;
  total_pending_eur: number;
  pending_item_count: number;
  expenses_total_eur: number;
  expenses_pending_eur: number;
  expenses_breakdown: unknown;
  breakdown_by_category: Record<string, {
    count: number;
    total_eur: number;
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
        _job_id: jobId,
      });

      if (error) throw error;

      const raw = Array.isArray(data) ? data?.[0] : data;
      if (!raw) {
        return null;
      }

      return {
        job_id: raw.job_id ?? jobId,
        total_approved_eur: Number(raw.total_approved_eur ?? 0),
        total_pending_eur: Number(raw.total_pending_eur ?? 0),
        pending_item_count: Number(raw.pending_item_count ?? 0),
        expenses_total_eur: Number(raw.expenses_total_eur ?? 0),
        expenses_pending_eur: Number(raw.expenses_pending_eur ?? 0),
        expenses_breakdown: raw.expenses_breakdown ?? [],
        breakdown_by_category: (raw.breakdown_by_category as JobTotals['breakdown_by_category']) ?? {},
        individual_amounts: (raw.individual_amounts as JobTotals['individual_amounts']) ?? [],
        user_can_see_all: Boolean(raw.user_can_see_all),
      } satisfies JobTotals;
    },
    enabled: !!jobId,
    staleTime: 30 * 1000, // 30 seconds
  });
}
