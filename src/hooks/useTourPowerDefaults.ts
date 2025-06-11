import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface TourPowerDefault {
  id: string;
  tour_id: string;
  table_name: string;
  total_watts: number;
  current_per_phase: number;
  pdu_type: string;
  custom_pdu_type?: string;
  includes_hoist: boolean;
  department: string | null;
  created_at?: string;
}

export const useTourPowerDefaults = (tourId: string) => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tour-power-defaults', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_power_defaults')
        .select('*')
        .eq('tour_id', tourId);

      if (error) throw error;
      return data as TourPowerDefault[];
    },
    enabled: !!tourId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<TourPowerDefault, 'id' | 'created_at'>) => {
      const { error } = await supabase
        .from('tour_power_defaults')
        .insert([data]);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-power-defaults', tourId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TourPowerDefault) => {
      const { error } = await supabase
        .from('tour_power_defaults')
        .update({
          table_name: data.table_name,
          total_watts: data.total_watts,
          current_per_phase: data.current_per_phase,
          pdu_type: data.pdu_type,
          custom_pdu_type: data.custom_pdu_type,
          includes_hoist: data.includes_hoist,
          department: data.department
        })
        .eq('id', data.id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-power-defaults', tourId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tour_power_defaults')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-power-defaults', tourId] });
    },
  });

  return {
    powerDefaults: data || [],
    isLoading,
    error,
    createDefault: createMutation.mutateAsync,
    updateDefault: updateMutation.mutateAsync,
    deleteDefault: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
