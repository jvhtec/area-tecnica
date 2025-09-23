import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { TourJobRateQuote } from '@/types/tourRates'

/**
 * Manager-only hook: returns rate quotes for all assigned technicians on a tour date.
 * Bypasses the auth-scoped view by computing quotes via RPC for each tour assignment.
 */
export function useTourJobRateQuotesForManager(jobId?: string, tourId?: string) {
  return useQuery({
    queryKey: ['tour-job-rate-quotes-manager', jobId, tourId],
    enabled: !!jobId && !!tourId,
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      if (!jobId || !tourId) return []

      // Get all internal technician assignments at tour-level
      const { data: tourAssignments, error: taErr } = await supabase
        .from('tour_assignments')
        .select('technician_id')
        .eq('tour_id', tourId)

      if (taErr) throw taErr

      const techIds = Array.from(
        new Set(
          (tourAssignments || [])
            .map((a: any) => a.technician_id)
            .filter((id: string | null): id is string => !!id)
        )
      )

      if (techIds.length === 0) return []

      // Compute quotes for each technician via RPC (security definer function)
      const results = await Promise.all(
        techIds.map(async (techId) => {
          const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', {
            _job_id: jobId,
            _tech_id: techId,
          })
          if (error) {
            // Return a minimal error object matching the Quote shape
            return {
              job_id: jobId,
              technician_id: techId,
              start_time: new Date().toISOString(),
              end_time: new Date().toISOString(),
              job_type: 'tourdate',
              tour_id: '',
              title: '',
              is_house_tech: false,
              is_tour_team_member: false,
              category: '',
              base_day_eur: 0,
              week_count: 1,
              multiplier: 1,
              iso_year: null,
              iso_week: null,
              total_eur: 0,
              breakdown: { error: error.message },
            } as TourJobRateQuote
          }

          // The RPC returns a JSON object with all fields; coerce to the expected type
          const q = (data || {}) as Record<string, any>

          return {
            job_id: q.job_id ?? jobId,
            technician_id: q.technician_id ?? techId,
            start_time: q.start_time,
            end_time: q.end_time,
            job_type: q.job_type ?? 'tourdate',
            tour_id: q.tour_id ?? '',
            title: q.title ?? '',
            is_house_tech: !!q.is_house_tech,
            is_tour_team_member: !!q.is_tour_team_member,
            category: q.category ?? '',
            base_day_eur: Number(q.base_day_eur ?? 0),
            week_count: Number(q.week_count ?? 1),
            multiplier: Number(q.multiplier ?? 1),
            iso_year: q.iso_year ?? null,
            iso_week: q.iso_week ?? null,
            total_eur: Number(q.total_eur ?? 0),
            extras: q.extras,
            extras_total_eur: q.extras_total_eur != null ? Number(q.extras_total_eur) : undefined,
            total_with_extras_eur: q.total_with_extras_eur != null ? Number(q.total_with_extras_eur) : undefined,
            vehicle_disclaimer: q.vehicle_disclaimer,
            vehicle_disclaimer_text: q.vehicle_disclaimer_text,
            breakdown: q.breakdown ?? {},
          } as TourJobRateQuote
        })
      )

      return results
    },
    staleTime: 30 * 1000,
  })
}

