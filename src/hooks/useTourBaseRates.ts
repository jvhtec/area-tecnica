import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TourCategory = 'tecnico' | 'especialista' | 'responsable';

export interface TourBaseRateRow {
  category: TourCategory;
  base_day_eur: number;
}

export function useTourBaseRates() {
  return useQuery({
    queryKey: ['tour-base-rates-2025'],
    queryFn: async (): Promise<TourBaseRateRow[]> => {
      const { data, error } = await supabase
        .from('rate_cards_tour_2025')
        .select('*')
        .order('category', { ascending: true });
      if (error) throw error;
      return (data || []) as TourBaseRateRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useSaveTourBaseRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (row: TourBaseRateRow) => {
      const { data, error } = await supabase
        .from('rate_cards_tour_2025')
        .upsert(row)
        .select()
        .single();
      if (error) throw error;
      return data as TourBaseRateRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-base-rates-2025'] });
      toast.success('Tour base rate saved');
    },
    onError: (err: any) => {
      console.error('Failed to save tour base rate', err);
      toast.error('Failed to save tour base rate');
    }
  });
}

