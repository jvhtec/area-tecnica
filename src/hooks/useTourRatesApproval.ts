import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTourRatesApproval(tourId?: string) {
  return useQuery({
    queryKey: ['tour-rates-approval', tourId],
    enabled: !!tourId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, rates_approved, rates_approved_at, rates_approved_by')
        .eq('id', tourId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; rates_approved: boolean; rates_approved_at: string | null; rates_approved_by: string | null } | null;
    }
  });
}

export function useTourRatesApprovalMap(tourIds: string[]) {
  const unique = useMemo(() => Array.from(new Set(tourIds.filter(Boolean))), [tourIds]);
  return useQuery({
    queryKey: ['tour-rates-approval-map', unique],
    enabled: unique.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('id, rates_approved')
        .in('id', unique);
      if (error) throw error;
      const map = new Map<string, boolean>();
      (data || []).forEach((r: any) => map.set(r.id, !!r.rates_approved));
      return map as Map<string, boolean>;
    }
  });
}

