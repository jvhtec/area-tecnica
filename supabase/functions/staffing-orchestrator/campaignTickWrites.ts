import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { logEvent } from "../_shared/structuredLogger.ts";
import {
  campaignClosureReason,
  campaignRoleChanged,
  type CampaignClosureReason,
  type CampaignRoleCounters,
} from "./orchestrationUtils.ts";

/**
 * Stops an active campaign whose job is over (ended, cancelled, completed or
 * deleted) and logs why. Such a campaign can no longer staff anything and
 * would otherwise be ticked every few minutes forever.
 *
 * Returns the closure reason when the campaign was stopped, null while it can
 * still run (or another tick took its lock meanwhile), or an error message.
 */
export async function closeCampaignIfJobOver(
  supabase: SupabaseClient,
  campaign: { id: string; job_id: string | null; run_lock?: string | null },
  now: Date,
): Promise<{ closed: CampaignClosureReason } | { error: string } | null> {
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("end_time, status")
    .eq("id", campaign.job_id)
    .maybeSingle();
  if (jobError) return { error: jobError.message };

  const reason = campaignClosureReason(job, now);
  if (!reason) return null;

  // Compare-and-swap on the lock read with the campaign (null, or a stale one
  // the caller has already judged dead), so a tick that took the lock since
  // keeps it; that tick closes the campaign itself next time.
  let closeQuery = supabase
    .from("staffing_campaigns")
    .update({ status: "stopped", run_lock: null, next_run_at: null, updated_at: now.toISOString() })
    .eq("id", campaign.id)
    .eq("status", "active");
  closeQuery = campaign.run_lock ? closeQuery.eq("run_lock", campaign.run_lock) : closeQuery.is("run_lock", null);
  const { data: closed, error: closeError } = await closeQuery.select("id");
  if (closeError) return { error: closeError.message };
  if (!closed?.length) return null;

  const { error: eventError } = await supabase
    .from("staffing_campaign_events")
    .insert({ campaign_id: campaign.id, phase: "system", reasons: { closed: reason } });
  if (eventError) {
    logEvent("warn", "staffing.campaign_closure_event_failed", {
      campaign_id: campaign.id,
      reason,
      error_code: eventError.code ?? null,
    });
  }

  return { closed: reason };
}

export type CampaignRoleUpdate = CampaignRoleCounters & { id: string; updated_at: string };

/**
 * Writes the tick's role counters, skipping rows that did not change: ticks run
 * every few minutes and rewriting identical rows only produced WAL and
 * realtime traffic. Returns an error message, or null.
 */
export async function applyRoleUpdates(
  supabase: SupabaseClient,
  currentRoles: Array<CampaignRoleCounters & { id: string }>,
  updates: CampaignRoleUpdate[],
): Promise<string | null> {
  const currentById = new Map(currentRoles.map((role) => [role.id, role]));

  for (const update of updates) {
    const current = currentById.get(update.id);
    if (current && !campaignRoleChanged(current, update)) continue;

    const { error } = await supabase
      .from("staffing_campaign_roles")
      .update({
        assigned_count: update.assigned_count,
        pending_availability: update.pending_availability,
        confirmed_availability: update.confirmed_availability,
        pending_offers: update.pending_offers,
        accepted_offers: update.accepted_offers,
        stage: update.stage,
        wave_number: update.wave_number,
        last_wave_at: update.last_wave_at,
        updated_at: update.updated_at,
      })
      .eq("id", update.id);
    if (error) return error.message;
  }

  return null;
}
