import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/react-query';
import { rateEstimateKey, type RateEstimateRange } from '@/components/matrix/lenses/cost';

const CATEGORIES = ['tecnico', 'especialista', 'responsable'] as const;
type Category = (typeof CATEGORIES)[number];

// A live-event work day commonly runs load-in to strike; used only to bound
// the high end of the estimate range (base day rate covers roughly
// base_day_hours..mid_tier_hours, this bounds the "long day" scenario).
const HIGH_HOURS_BOUND = 20;

interface RateCardRow {
  category: Category;
  base_day_eur: number;
  plus_10_12_eur: number;
  overtime_hour_eur: number;
  mid_tier_hours: number;
}

interface CustomRateRow {
  profile_id: string;
  base_day_eur: number;
  plus_10_12_eur: number | null;
  overtime_hour_eur: number | null;
  base_day_especialista_eur: number | null;
  base_day_responsable_eur: number | null;
}

interface UseMatrixRateEstimatesArgs {
  technicianIds: string[];
  enabled: boolean;
}

const EMPTY_MAP = new Map<string, RateEstimateRange>();

const categoryBaseOverride = (custom: CustomRateRow | undefined, category: Category): number | null => {
  if (!custom) return null;
  if (category === 'responsable') {
    return custom.base_day_responsable_eur ?? custom.base_day_especialista_eur ?? null;
  }
  if (category === 'especialista') {
    return custom.base_day_especialista_eur ?? null;
  }
  return null;
};

/**
 * Rough day-rate-only preview for cells that don't have a real computed
 * amount_eur yet (no worked hours logged). Deliberately skips overtime
 * tiering beyond a single "long day" bound, night hours, and holiday
 * premiums — compute_timesheet_hours() is the source of truth once a
 * timesheet has actual times; this is only meant to bound expectations
 * before that exists, hence a [low, high] range rather than one number.
 *
 * Rate precedence mirrors custom_tech_rates' documented fallback chain:
 * category-specific override -> flat base_day_eur -> rate_cards_2025 by
 * category.
 */
export const useMatrixRateEstimates = ({ technicianIds, enabled }: UseMatrixRateEstimatesArgs) => {
  const { data: rateCards } = useQuery({
    queryKey: queryKeys.scope('matrix-rate-cards-2025'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_cards_2025')
        .select('category, base_day_eur, plus_10_12_eur, overtime_hour_eur, mid_tier_hours');
      if (error) throw error;
      const map = new Map<Category, RateCardRow>();
      (data as RateCardRow[] | null ?? []).forEach((row) => map.set(row.category, row));
      return map;
    },
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const technicianIdsKey = useMemo(() => technicianIds.slice().sort().join(','), [technicianIds]);
  const { data: customRates } = useQuery({
    queryKey: queryKeys.scope('matrix-custom-tech-rates', technicianIdsKey),
    queryFn: async () => {
      const map = new Map<string, CustomRateRow>();
      if (!technicianIds.length) return map;
      const { data, error } = await supabase
        .from('custom_tech_rates')
        .select('profile_id, base_day_eur, plus_10_12_eur, overtime_hour_eur, base_day_especialista_eur, base_day_responsable_eur')
        .in('profile_id', technicianIds);
      if (error) throw error;
      (data as CustomRateRow[] | null ?? []).forEach((row) => map.set(row.profile_id, row));
      return map;
    },
    enabled: enabled && technicianIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  return useMemo(() => {
    if (!enabled || !rateCards) return EMPTY_MAP;
    const map = new Map<string, RateEstimateRange>();

    technicianIds.forEach((technicianId) => {
      const custom = customRates?.get(technicianId);

      CATEGORIES.forEach((category) => {
        const card = rateCards.get(category);
        const base = categoryBaseOverride(custom, category) ?? custom?.base_day_eur ?? card?.base_day_eur;
        if (base == null) return;

        const plus1012 = custom?.plus_10_12_eur ?? card?.plus_10_12_eur ?? 0;
        const overtimeHour = custom?.overtime_hour_eur ?? card?.overtime_hour_eur ?? 0;
        const midTierHours = card?.mid_tier_hours ?? 12;

        const low = base;
        const high = base + plus1012 + overtimeHour * Math.max(0, HIGH_HOURS_BOUND - midTierHours);

        map.set(rateEstimateKey(technicianId, category), { low, high: Math.max(low, high) });
      });
    });

    return map;
  }, [enabled, rateCards, customRates, technicianIds]);
};
