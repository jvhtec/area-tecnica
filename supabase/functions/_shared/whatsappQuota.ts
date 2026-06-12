/**
 * Per-actor daily quota + audit ledger for outbound WhatsApp operations,
 * backed by the attempt_whatsapp_send RPC (whatsapp_send_audit table). The
 * RPC takes a per-actor advisory lock and does the count + ledger insert in
 * one transaction, so concurrent bursts cannot overshoot the quota.
 *
 * Quotas are defense-in-depth against a compromised admin/management
 * account burning WAHA capacity, so an RPC infrastructure failure (e.g.
 * migration not yet applied) fails open — the send proceeds, with a
 * warning — rather than blocking production traffic.
 */

type RpcRow = { allowed: boolean; used_today: number };

export interface WhatsappQuotaClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: RpcRow[] | RpcRow | null; error: { message?: string } | null }>;
}

export type WhatsappQuotaKind = "job_message" | "group_creation";

export interface WhatsappQuotaArgs {
  supabase: WhatsappQuotaClient;
  actorId: string;
  kind: WhatsappQuotaKind;
  /** Recipients in this request; group creations count as one unit each. */
  recipientCount?: number;
  jobId?: string | null;
  dailyLimit: number;
}

export interface WhatsappQuotaResult {
  allowed: boolean;
  usedToday: number;
  dailyLimit: number;
}

export async function checkAndRecordWhatsappQuota(args: WhatsappQuotaArgs): Promise<WhatsappQuotaResult> {
  const { supabase, actorId, kind, jobId = null, dailyLimit } = args;
  const unitsRequested = kind === "job_message" ? Math.max(0, args.recipientCount ?? 0) : 1;

  try {
    const { data, error } = await supabase.rpc("attempt_whatsapp_send", {
      _actor_id: actorId,
      _kind: kind,
      _units: unitsRequested,
      _daily_limit: dailyLimit,
      _job_id: jobId,
      _recipient_count: args.recipientCount ?? 0,
    });

    if (error) throw new Error(error.message || "quota RPC failed");

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("quota RPC returned no row");
    }

    return { allowed: row.allowed, usedToday: row.used_today ?? 0, dailyLimit };
  } catch (err) {
    console.warn(
      "whatsapp quota check failed, allowing send:",
      err instanceof Error ? err.message : String(err),
    );
    return { allowed: true, usedToday: 0, dailyLimit };
  }
}
