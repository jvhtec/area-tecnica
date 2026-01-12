import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';

export interface HouseTechRate {
  profile_id: string;
  base_day_eur: number;
  base_day_especialista_eur?: number | null;
  base_day_responsable_eur?: number | null;
  tour_base_responsable_eur?: number;
  tour_base_other_eur?: number;
  tour_base_especialista_eur?: number | null;
  plus_10_12_eur?: number;
  overtime_hour_eur?: number;
  currency: string;
  updated_by?: string;
  updated_at: string;
}

export interface HouseTechRateInput {
  profile_id: string;
  base_day_eur: number;
  base_day_especialista_eur?: number | null;
  base_day_responsable_eur?: number | null;
  tour_base_responsable_eur?: number | null;
  tour_base_other_eur?: number | null;
  tour_base_especialista_eur?: number | null;
  plus_10_12_eur?: number | null;
  overtime_hour_eur?: number | null;
}

export function useHouseTechRate(profileId: string) {
  return useQuery({
    queryKey: RATES_QUERY_KEYS.houseTechRate(profileId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_tech_rates')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (error) throw error;
      return data as HouseTechRate | null;
    },
    enabled: !!profileId,
  });
}

export function useSaveHouseTechRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: HouseTechRateInput) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('custom_tech_rates')
        .upsert({
          ...input,
          updated_by: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.houseTechRate(variables.profile_id) });
      toast.success('House tech rate saved successfully');
    },
    onError: (error) => {
      console.error('Error saving house tech rate:', error);
      toast.error('Failed to save house tech rate');
    },
  });
}

export function useLogRateActivity() {
  return useMutation({
    mutationFn: async ({ profileId, profileName }: { profileId: string; profileName: string }) => {
      const { error } = await supabase.rpc('log_activity', {
        _code: 'settings.house_rate.updated',
        _job_id: null,
        _entity_type: 'profile',
        _entity_id: profileId,
        _payload: { profile_name: profileName },
        _visibility: 'management',
      });

      if (error) throw error;
    },
  });
}
