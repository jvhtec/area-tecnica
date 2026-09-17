import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import type { BroadcastBody, PushPayload } from "./types.ts";
import type { DeliveryResult } from "./broadcast/delivery.ts";
import { categoryForEvent, type NotificationUrgency } from "./notificationPolicy.ts";

type InboxRow = { id: string; user_id: string };

export async function claimInboxItems(
  client: SupabaseClient,
  recipientIds: string[],
  eventKey: string,
  body: BroadcastBody,
  payload: PushPayload,
  urgency: NotificationUrgency,
  includeRetryable = false,
): Promise<Map<string, string>> {
  const rows = recipientIds.map((userId) => ({
    user_id: userId,
    event_key: eventKey,
    event_type: body.type,
    category: categoryForEvent(body.type),
    urgency,
    title: payload.title,
    body: payload.body ?? null,
    url: payload.url ?? "/",
    meta: payload.meta ?? {},
    expires_at: payload.ttlSeconds
      ? new Date(Date.now() + payload.ttlSeconds * 1000).toISOString()
      : null,
  }));
  const { data, error } = await client
    .from("notification_inbox")
    .upsert(rows, { onConflict: "user_id,event_key", ignoreDuplicates: true })
    .select("id, user_id")
    .returns<InboxRow[]>();
  if (error) throw error;
  if (!includeRetryable) {
    return new Map((data ?? []).map((row) => [row.user_id, row.id]));
  }

  // Scheduled occurrences have their own atomic lease, so a retry can safely
  // reuse inbox rows whose previous delivery never reached a provider.
  const { data: retryableRows, error: retryableError } = await client
    .from("notification_inbox")
    .select("id, user_id")
    .eq("event_key", eventKey)
    .in("user_id", recipientIds)
    .in("provider_status", ["pending", "failed"])
    .returns<InboxRow[]>();
  if (retryableError) throw retryableError;
  return new Map((retryableRows ?? []).map((row) => [row.user_id, row.id]));
}

export async function recordDeliveryResults(
  client: SupabaseClient,
  inboxIds: Map<string, string>,
  results: DeliveryResult[],
  skippedUserIds: string[],
  failedUserIds: string[] = [],
): Promise<void> {
  const attempts = results.flatMap((result) => {
    const inboxId = result.userId ? inboxIds.get(result.userId) : undefined;
    if (!inboxId || !result.userId) return [];
    return [{
      inbox_id: inboxId,
      user_id: result.userId,
      channel: result.channel,
      target_fingerprint: result.endpoint,
      status: result.ok ? "accepted" : result.skipped ? "skipped" : "failed",
      status_code: result.status ?? null,
      attempt_count: result.attempts,
      last_error_code: result.errorCode ?? null,
      attempted_at: new Date().toISOString(),
      accepted_at: result.ok ? new Date().toISOString() : null,
    }];
  });
  if (attempts.length > 0) {
    const { error } = await client
      .from("push_delivery_attempts")
      .upsert(attempts, { onConflict: "inbox_id,target_fingerprint" });
    if (error) {
      logEvent("error", "push_delivery_attempt_persistence_failed", {
        errorCode: error.code ?? "unknown",
      });
    }
  }

  for (const [userId, inboxId] of inboxIds) {
    const userResults = results.filter((result) => result.userId === userId);
    const accepted = userResults.filter((result) => result.ok).length;
    const failed = userResults.filter((result) => !result.ok && !result.skipped).length
      + (failedUserIds.includes(userId) ? 1 : 0);
    const providerStatus = failedUserIds.includes(userId)
      ? "failed"
      : skippedUserIds.includes(userId)
      ? "skipped"
      : accepted > 0 && failed > 0
        ? "partial"
        : accepted > 0
          ? "accepted"
          : failed > 0
            ? "failed"
            : "skipped";
    const { error } = await client
      .from("notification_inbox")
      .update({ provider_status: providerStatus, accepted_count: accepted, failed_count: failed })
      .eq("id", inboxId);
    if (error) {
      logEvent("error", "notification_inbox_outcome_persistence_failed", {
        errorCode: error.code ?? "unknown",
      });
    }
  }
}
