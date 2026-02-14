import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TourJobRateQuote } from '@/types/tourRates';
import { attachPayoutOverridesToTourQuotes } from '@/services/tourPayoutOverrides';

export function useManagerJobQuotes(jobId?: string, jobType?: string, tourId?: string) {
  return useQuery({
    queryKey: ['manager-job-quotes', jobId, jobType, tourId],
    enabled: !!jobId,
    queryFn: async (): Promise<TourJobRateQuote[]> => {
      if (!jobId) return [] as TourJobRateQuote[];
      const jt = String(jobType || '').toLowerCase();

      // Tour dates: reuse RPC quote computation per assignment
      if (jt === 'tourdate') {
        // Get job-level assignments
        const { data: jobAssignments, error: jaErr } = await supabase
          .from('job_assignments')
          .select('technician_id')
          .eq('job_id', jobId);
        if (jaErr) throw jaErr;
        const techIds = Array.from(new Set((jobAssignments || []).map((a: any) => a.technician_id).filter(Boolean)));
        if (techIds.length === 0) return [] as TourJobRateQuote[];

        const results = await Promise.all(
          techIds.map(async (techId) => {
            const { data, error } = await supabase.rpc('compute_tour_job_rate_quote_2025', {
              _job_id: jobId,
              _tech_id: techId,
            });
            if (error) {
              console.error(`RPC error for job ${jobId}, tech ${techId}:`, error);
              const errorMsg = error.message || error.details || error.hint || String(error);
              return {
                job_id: jobId,
                technician_id: techId,
                start_time: new Date().toISOString(),
                end_time: new Date().toISOString(),
                job_type: 'tourdate',
                tour_id: tourId || '',
                title: '',
                is_house_tech: false,
                is_tour_team_member: false,
                category: '',
                base_day_eur: 0,
                week_count: 1,
                multiplier: 1,
                per_job_multiplier: 1,
                iso_year: null,
                iso_week: null,
                total_eur: 0,
                extras: undefined,
                extras_total_eur: undefined,
                total_with_extras_eur: undefined,
                breakdown: { error: errorMsg, error_details: error },
              } as TourJobRateQuote;
            }
            const q = (data || {}) as Record<string, any>;
            return {
              job_id: q.job_id ?? jobId,
              technician_id: q.technician_id ?? techId,
              start_time: q.start_time,
              end_time: q.end_time,
              job_type: q.job_type ?? 'tourdate',
              tour_id: q.tour_id ?? tourId ?? '',
              title: q.title ?? '',
              is_house_tech: !!q.is_house_tech,
              is_tour_team_member: !!q.is_tour_team_member,
              category: q.category ?? '',
              base_day_eur: Number(q.base_day_eur ?? 0),
              week_count: Number(q.week_count ?? 1),
              multiplier: Number(q.multiplier ?? 1),
              per_job_multiplier:
                q.per_job_multiplier != null ? Number(q.per_job_multiplier) : undefined,
              iso_year: q.iso_year ?? null,
              iso_week: q.iso_week ?? null,
              total_eur: Number(q.total_eur ?? 0),
              extras: q.extras,
              extras_total_eur: q.extras_total_eur != null ? Number(q.extras_total_eur) : undefined,
              total_with_extras_eur: q.total_with_extras_eur != null ? Number(q.total_with_extras_eur) : undefined,
              vehicle_disclaimer: q.vehicle_disclaimer,
              vehicle_disclaimer_text: q.vehicle_disclaimer_text,
              breakdown: q.breakdown ?? {},
            } as TourJobRateQuote;
          })
        );

        return attachPayoutOverridesToTourQuotes(jobId, results as TourJobRateQuote[]);
      }

      // Single/festival jobs within a tour: use payout totals view
      const { data: payouts, error } = await supabase
        .from('v_job_tech_payout_2025')
        .select('job_id, technician_id, timesheets_total_eur, extras_total_eur, total_eur')
        .eq('job_id', jobId);
      if (error) throw error;
      const list = (payouts || []) as Array<{ job_id: string; technician_id: string; timesheets_total_eur: number; extras_total_eur: number; total_eur: number }>;
      return list.map((p) => ({
        job_id: p.job_id,
        technician_id: p.technician_id,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        job_type: jt || 'single',
        tour_id: tourId || '',
        title: '',
        is_house_tech: false,
        is_tour_team_member: false,
        category: '',
        base_day_eur: Number(p.timesheets_total_eur || 0), // Timesheets total (base from worked hours)
        week_count: 1,
        multiplier: 1,
        per_job_multiplier: 1,
        iso_year: null,
        iso_week: null,
        total_eur: Number(p.timesheets_total_eur || 0), // Base total (same as timesheets for non-tour jobs)
        extras: undefined,
        extras_total_eur: Number(p.extras_total_eur || 0),
        total_with_extras_eur: Number(p.total_eur || 0), // Total including extras
        breakdown: {},
      })) as TourJobRateQuote[];
    },
    staleTime: 30 * 1000,
  });
}

