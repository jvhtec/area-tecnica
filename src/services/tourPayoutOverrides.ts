import { supabase } from '@/integrations/supabase/client';
import type { TourJobRateQuote } from '@/types/tourRates';

/**
 * Manual payout overrides live in `job_technician_payout_overrides`.
 * The tour-date quote RPC (`compute_tour_job_rate_quote_2025`) does NOT include override fields.
 *
 * This helper merges overrides into TourJobRateQuote objects so PDFs/emails/UI can reflect the exception.
 *
 * Note: we DO NOT overwrite `total_eur` / `total_with_extras_eur` here because tour-date quotes can be
 * treated as per-day rates in some flows (multi-day rehearsals). Consumers should use
 * `override_amount_eur` when `has_override` is true.
 */
export async function attachPayoutOverridesToTourQuotes(
  jobId: string,
  quotes: TourJobRateQuote[]
): Promise<TourJobRateQuote[]> {
  if (!jobId || quotes.length === 0) return quotes;

  const techIds = Array.from(
    new Set(quotes.map((q) => q.technician_id).filter((id): id is string => Boolean(id)))
  );
  if (techIds.length === 0) return quotes;

  const { data: overrides, error } = await supabase
    .from('job_technician_payout_overrides')
    .select('technician_id, override_amount_eur')
    .eq('job_id', jobId)
    .in('technician_id', techIds);

  if (error) {
    // Best-effort: return original quotes if override lookup fails
    console.warn('[attachPayoutOverridesToTourQuotes] override fetch failed', error);
    return quotes;
  }

  const map = new Map<string, number>();
  (overrides || []).forEach((row: any) => {
    if (!row?.technician_id) return;
    map.set(row.technician_id, Number(row.override_amount_eur));
  });

  return quotes.map((q) => {
    const amt = map.get(q.technician_id);
    if (amt == null || !Number.isFinite(amt)) {
      return {
        ...q,
        has_override: false,
        override_amount_eur: undefined,
        calculated_total_eur: q.total_with_extras_eur ?? q.total_eur,
      };
    }

    return {
      ...q,
      has_override: true,
      override_amount_eur: amt,
      calculated_total_eur: q.total_with_extras_eur ?? q.total_eur,
    };
  });
}
