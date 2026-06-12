/**
 * Per-actor daily quota + audit ledger for outbound WhatsApp operations,
 * backed by the whatsapp_send_audit table (written with the service role).
 *
 * Quotas are defense-in-depth against a compromised admin/management
 * account burning WAHA capacity, so a failed ledger READ fails open (the
 * send proceeds, with a warning) rather than blocking production traffic.
 */

type QueryResult = { data: Array<{ recipient_count: number | null }> | null; error: { message?: string } | null };

export interface WhatsappQuotaClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          gte(column: string, value: string): PromiseLike<QueryResult>;
        };
      };
    };
    insert(row: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>;
  };
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
  now?: Date;
}

export interface WhatsappQuotaResult {
  allowed: boolean;
  usedToday: number;
  dailyLimit: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function checkAndRecordWhatsappQuota(args: WhatsappQuotaArgs): Promise<WhatsappQuotaResult> {
  const { supabase, actorId, kind, jobId = null, dailyLimit } = args;
  const now = args.now ?? new Date();
  const unitsRequested = kind === "job_message" ? Math.max(0, args.recipientCount ?? 0) : 1;
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString();

  let usedToday = 0;
  try {
    const { data, error } = await supabase
      .from("whatsapp_send_audit")
      .select("recipient_count")
      .eq("actor_id", actorId)
      .eq("kind", kind)
      .gte("created_at", windowStart);

    if (error) throw new Error(error.message || "quota lookup failed");

    usedToday = kind === "job_message"
      ? (data ?? []).reduce((sum, row) => sum + (row.recipient_count ?? 0), 0)
      : (data ?? []).length;
  } catch (err) {
    console.warn("whatsapp quota lookup failed, allowing send:", err instanceof Error ? err.message : String(err));
    usedToday = 0;
  }

  if (usedToday + unitsRequested > dailyLimit) {
    return { allowed: false, usedToday, dailyLimit };
  }

  try {
    const { error: insertError } = await supabase.from("whatsapp_send_audit").insert({
      actor_id: actorId,
      kind,
      job_id: jobId,
      recipient_count: kind === "job_message" ? unitsRequested : args.recipientCount ?? 0,
    });
    if (insertError) {
      console.warn("whatsapp quota ledger insert failed:", insertError.message);
    }
  } catch (err) {
    console.warn("whatsapp quota ledger insert failed:", err instanceof Error ? err.message : String(err));
  }

  return { allowed: true, usedToday, dailyLimit };
}
