import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useJobRatesApproval(jobId?: string) {
  return useQuery({
    queryKey: ['job-rates-approval', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, rates_approved, rates_approved_at, rates_approved_by')
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; rates_approved: boolean; rates_approved_at: string | null; rates_approved_by: string | null } | null;
    }
  });
}

export function useJobRatesApprovalMap(jobIds: string[]) {
  const unique = useMemo(() => Array.from(new Set(jobIds.filter(Boolean))), [jobIds]);
  return useQuery({
    queryKey: ['job-rates-approval-map', unique],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, rates_approved')
        .in('id', unique);
      if (error) throw error;
      const map = new Map<string, boolean>();
      (data || []).forEach((r: any) => map.set(r.id, !!r.rates_approved));
      return map as Map<string, boolean>;
    }
  });
}

