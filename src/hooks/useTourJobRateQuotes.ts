import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TourJobRateQuote } from '@/types/tourRates';
import type { Database } from '@/integrations/supabase/types';

type TourJobRateQuoteRow = Database['public']['Views']['v_tour_job_rate_quotes_2025']['Row'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizeExtras = (value: TourJobRateQuoteRow['extras']): TourJobRateQuote['extras'] | undefined =>
  isRecord(value) ? value as TourJobRateQuote['extras'] : undefined;

const normalizeBreakdown = (value: TourJobRateQuoteRow['breakdown']): TourJobRateQuote['breakdown'] =>
  isRecord(value) ? value as TourJobRateQuote['breakdown'] : {};

const normalizeTourJobRateQuote = (item: TourJobRateQuoteRow): TourJobRateQuote => ({
  job_id: item.job_id ?? '',
  technician_id: item.technician_id ?? '',
  start_time: item.start_time ?? '',
  end_time: item.end_time ?? '',
  job_type: item.job_type ?? '',
  tour_id: item.tour_id ?? '',
  title: item.title ?? '',
  is_house_tech: item.is_house_tech ?? false,
  is_tour_team_member: item.is_tour_team_member ?? false,
  category: item.category ?? '',
  base_day_eur: item.base_day_eur ?? 0,
  week_count: item.week_count ?? 1,
  multiplier: item.multiplier ?? 1,
  per_job_multiplier: item.per_job_multiplier != null ? Number(item.per_job_multiplier) : undefined,
  iso_year: item.iso_year,
  iso_week: item.iso_week,
  total_eur: item.total_eur ?? 0,
  extras: normalizeExtras(item.extras),
  extras_total_eur: item.extras_total_eur ?? undefined,
  total_with_extras_eur: item.total_with_extras_eur ?? undefined,
  vehicle_disclaimer: item.vehicle_disclaimer ?? undefined,
  vehicle_disclaimer_text: item.vehicle_disclaimer_text ?? undefined,
  breakdown: normalizeBreakdown(item.breakdown),
  autonomo_discount_eur: item.autonomo_discount_eur ?? undefined,
  has_override: item.has_override ?? undefined,
  override_amount_eur: item.override_amount_eur ?? undefined,
  calculated_total_eur: item.calculated_total_eur ?? undefined,
});

export function useTourJobRateQuotes(jobId?: string) {
  return useQuery({
    queryKey: ['tour-job-rate-quotes', jobId],
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      const query = supabase
        .from('v_tour_job_rate_quotes_2025')
        .select('*');
        
      if (jobId) {
        query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(normalizeTourJobRateQuote);
    },
    enabled: !!jobId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useTechnicianTourRateQuotes() {
  return useQuery({
    queryKey: ['technician-tour-rate-quotes'],
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      const { data, error } = await supabase
        .from('v_tour_job_rate_quotes_2025')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(normalizeTourJobRateQuote);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
