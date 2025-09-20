import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HouseTechRate {
  profile_id: string;
  base_day_eur: number;
  plus_10_12_eur?: number;
  overtime_hour_eur?: number;
  currency: string;
  updated_by?: string;
  updated_at: string;
}

export interface HouseTechRateInput {
  profile_id: string;
  base_day_eur: number;
  plus_10_12_eur?: number | null;
  overtime_hour_eur?: number | null;
}

export function useHouseTechRate(profileId: string) {
  return useQuery({
    queryKey: ['house-tech-rate', profileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('house_tech_rates')
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
        .from('house_tech_rates')
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
      queryClient.invalidateQueries({ queryKey: ['house-tech-rate', variables.profile_id] });
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