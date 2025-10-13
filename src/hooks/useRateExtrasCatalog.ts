import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

export interface RateExtraRow {
  extra_type: 'travel_half' | 'travel_full' | 'day_off';
  amount_eur: number;
}

export function useRateExtrasCatalog() {
  return useQuery({
    queryKey: RATES_QUERY_KEYS.extrasCatalog,
    queryFn: async (): Promise<RateExtraRow[]> => {
      const { data, error } = await supabase
        .from('rate_extras_2025')
        .select('*')
        .order('extra_type', { ascending: true });
      if (error) throw error;
      return (data || []) as RateExtraRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useSaveRateExtra() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ extra_type, amount_eur }: RateExtraRow) => {
      const { data, error } = await supabase
        .from('rate_extras_2025')
        .upsert({ extra_type, amount_eur })
        .select()
        .single();
      if (error) throw error;
      return data as RateExtraRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.extrasCatalog });
      toast.success('Extras catalog updated');
    },
    onError: (err: any) => {
      console.error('Failed to update extras catalog', err);
      toast.error('Failed to update extras amount');
    }
  });
}

