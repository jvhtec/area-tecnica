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
    .select('technician_id, override_amount_eur, set_at, set_by')
    .eq('job_id', jobId)
    .in('technician_id', techIds);

  if (error) {
    // Best-effort: return original quotes if override lookup fails
    console.warn('[attachPayoutOverridesToTourQuotes] override fetch failed', error);
    return quotes;
  }

  const actorIds = Array.from(
    new Set(
      (overrides || [])
        .map((row: any) => row?.set_by)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );

  const actorMap = new Map<string, { name: string | null; email: string | null }>();
  if (actorIds.length > 0) {
    const { data: actors, error: actorError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', actorIds);

    if (actorError) {
      console.warn('[attachPayoutOverridesToTourQuotes] override actor lookup failed', actorError);
    } else {
      (actors || []).forEach((actor: any) => {
        if (!actor?.id) return;
        const fullName = `${actor.first_name || ''} ${actor.last_name || ''}`.trim();
        actorMap.set(actor.id, {
          name: fullName || null,
          email: actor.email ?? null,
        });
      });
    }
  }

  const map = new Map<
    string,
    { amount: number; setAt?: string; actorName?: string | null; actorEmail?: string | null }
  >();
  (overrides || []).forEach((row: any) => {
    if (!row?.technician_id) return;
    const amount = Number(row.override_amount_eur);
    const actor = row?.set_by ? actorMap.get(row.set_by) : undefined;
    map.set(row.technician_id, {
      amount,
      setAt: row?.set_at ?? undefined,
      actorName: actor?.name ?? null,
      actorEmail: actor?.email ?? null,
    });
  });

  return quotes.map((q) => {
    const override = map.get(q.technician_id);
    if (override == null || !Number.isFinite(override.amount)) {
      return {
        ...q,
        has_override: false,
        override_amount_eur: undefined,
        calculated_total_eur: q.total_with_extras_eur ?? q.total_eur,
        override_set_at: undefined,
        override_actor_name: undefined,
        override_actor_email: undefined,
      };
    }

    return {
      ...q,
      has_override: true,
      override_amount_eur: override.amount,
      calculated_total_eur: q.total_with_extras_eur ?? q.total_eur,
      override_set_at: override.setAt,
      override_actor_name: override.actorName ?? undefined,
      override_actor_email: override.actorEmail ?? undefined,
    };
  });
}
