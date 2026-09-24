import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { broadcastPush } from "../_shared/pushBroadcast.ts";

export type CampaignTickOutcome = {
  campaignId: string;
  lockId: string;
  allFilled: boolean;
  nextRunAt: string | null;
  now: string;
  jobId: string | null;
  department: string | null;
  createdBy: string | null;
};

/**
 * Releases the campaign's run lock and records the tick's outcome, then — only
 * on the transition into 'completed' — announces it.
 *
 * Keeping the release and the announcement together means the notification can
 * never fire for a tick whose state never landed, and it fires once per
 * completion rather than on every subsequent tick, because a completed campaign
 * is no longer picked up for ticking.
 *
 * Returns an error message when the state could not be written, or null.
 */
export async function finalizeCampaignTick(
  supabase: SupabaseClient,
  outcome: CampaignTickOutcome,
): Promise<string | null> {
  const { error } = await supabase
    .from("staffing_campaigns")
    .update({
      run_lock: null,
      next_run_at: outcome.nextRunAt,
      status: outcome.allFilled ? "completed" : "active",
      updated_at: outcome.now,
    })
    .eq("id", outcome.campaignId)
    .eq("run_lock", outcome.lockId);

  if (error) return error.message;

  if (outcome.allFilled) {
    // Best-effort: the campaign is already completed, so a push failure must not
    // turn a successful tick into a failed one.
    await broadcastPush({
      type: "staffing.campaign.completed",
      campaign_id: outcome.campaignId,
      job_id: outcome.jobId ?? undefined,
      department: outcome.department ?? undefined,
      recipient_id: outcome.createdBy ?? undefined,
    });
  }

  return null;
}
