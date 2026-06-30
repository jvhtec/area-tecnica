import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';
import { recalculateTimesheets } from '@/hooks/useToggleJobRehearsalRate';

/**
 * Recomputes a technician's non-approved timesheets so existing drafts pick up a
 * newly saved custom rate. Approved timesheets are intentionally left untouched
 * to avoid silently changing settled amounts. Failures are logged but never fail
 * the rate save itself (the rate is already persisted at this point).
 */
async function recalcTechnicianDraftTimesheets(profileId: string): Promise<number> {
  const { data: timesheets, error } = await supabase
    .from('timesheets')
    .select('id')
    .eq('technician_id', profileId)
    .eq('is_active', true)
    .neq('status', 'approved');

  if (error) {
    console.warn('Could not load timesheets to recalc after rate change:', error);
    return 0;
  }

  const ids = (timesheets || []).map((ts) => ts.id);
  if (ids.length === 0) return 0;

  try {
    return await recalculateTimesheets(ids);
  } catch (recalcError) {
    console.warn('Some timesheets failed to recalc after rate change:', recalcError);
    return 0;
  }
}

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
  overtime_hour_especialista_eur?: number | null;
  overtime_hour_responsable_eur?: number | null;
  travel_half_day_eur?: number | null;
  travel_full_day_eur?: number | null;
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
  overtime_hour_especialista_eur?: number | null;
  overtime_hour_responsable_eur?: number | null;
  travel_half_day_eur?: number | null;
  travel_full_day_eur?: number | null;
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

      // Recompute the technician's existing (non-approved) timesheets so they
      // reflect the new custom rate instead of the previously cached base rate.
      const recalculated = await recalcTechnicianDraftTimesheets(input.profile_id);

      return { rate: data, recalculated };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.houseTechRate(variables.profile_id) });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      toast.success(
        'House tech rate saved successfully',
        result.recalculated > 0
          ? { description: `${result.recalculated} parte(s) recalculado(s)` }
          : undefined,
      );
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
