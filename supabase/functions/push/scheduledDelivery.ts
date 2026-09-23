import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { loadNativeTokens, sendPayloadToTargets, type DeliveryResult } from "./broadcast/delivery.ts";
import { claimInboxItems, recordDeliveryResults } from "./inbox.ts";
import {
  buildEventKey,
  decoratePayloadPolicy,
  loadRecipientPreferences,
  urgencyForEvent,
} from "./notificationPolicy.ts";
import type { BroadcastBody, PushPayload, PushSubscriptionRow } from "./types.ts";

export type ScheduledUserOutcome =
  /** Inbox row already terminal for this occurrence (earlier run delivered it). */
  | { status: "duplicate" }
  /** Opted out, quiet hours, or no registered device: terminal, not an error. */
  | { status: "skipped" }
  /** A lookup failed before any provider was tried; the row stays retryable. */
  | { status: "failed" }
  | { status: "delivered"; sent: boolean; results: DeliveryResult[] };

export type ScheduledMessage = {
  title: string;
  body: string;
  url: string;
  meta?: Record<string, unknown>;
};

/**
 * Delivers one scheduled occurrence to one user through the same durable path
 * as a broadcast: claim the inbox row (reusing a retryable one), honour the
 * recipient's preferences, then send to every enabled device and record the
 * outcome. Shared by every per-user scheduled notification so each one gets the
 * inbox, preference and retry semantics without re-implementing them.
 */
export async function deliverScheduledToUser(
  client: SupabaseClient,
  userId: string,
  notificationBody: BroadcastBody,
  message: ScheduledMessage,
): Promise<ScheduledUserOutcome> {
  const type = notificationBody.type;
  const eventKey = await buildEventKey(notificationBody);
  const urgency = urgencyForEvent(type);
  const payload = decoratePayloadPolicy({
    title: message.title,
    body: message.body,
    url: message.url,
    type,
    meta: message.meta,
  } satisfies PushPayload, notificationBody, eventKey, urgency);

  const inboxIds = await claimInboxItems(
    client,
    [userId],
    eventKey,
    notificationBody,
    payload,
    urgency,
    true,
  );
  if (inboxIds.size === 0) return { status: "duplicate" };

  try {
    const preference = (await loadRecipientPreferences(client, [userId], notificationBody, urgency)).get(userId);
    if (
      preference?.accountEnabled === false
      || preference?.categoryEnabled === false
      || preference?.quietNow === true
      || preference?.muted === true
    ) {
      await recordDeliveryResults(client, inboxIds, [], [userId]);
      return { status: "skipped" };
    }
  } catch (error) {
    logEvent("error", "scheduled_push_preference_lookup_failed", {
      eventType: type,
      errorCode: error instanceof Error ? error.name : "unknown",
    });
    await recordDeliveryResults(client, inboxIds, [], [], [userId]);
    return { status: "failed" };
  }

  // Load push targets only after the durable inbox item is claimed.
  const { data: pushSubs, error: pushSubsErr } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .eq("enabled", true)
    .returns<PushSubscriptionRow[]>();
  if (pushSubsErr) {
    logEvent("error", "scheduled_push_subscription_lookup_failed", {
      eventType: type,
      errorCode: pushSubsErr.code ?? "unknown",
    });
    await recordDeliveryResults(client, inboxIds, [], [], [userId]);
    return { status: "failed" };
  }

  const nativeResult = await loadNativeTokens(client, [userId]);
  if (nativeResult.error) {
    await recordDeliveryResults(client, inboxIds, [], [], [userId]);
    return { status: "failed" };
  }
  const nativeTokens = nativeResult.tokens;
  if ((!pushSubs || pushSubs.length === 0) && nativeTokens.length === 0) {
    await recordDeliveryResults(client, inboxIds, [], [userId]);
    return { status: "skipped" };
  }

  // Send with the shared bounded-concurrency and transient-retry policy.
  const results = await sendPayloadToTargets(
    client,
    (pushSubs || []).map((subscription) => ({ ...subscription, user_id: userId })),
    nativeTokens,
    payload,
  );
  await recordDeliveryResults(client, inboxIds, results, []);
  return { status: "delivered", sent: results.some((result) => result.ok), results };
}

export type ScheduledRunTally = {
  successfulUsers: number;
  providerAttempts: number;
  hadOperationalFailure: boolean;
};

export function emptyTally(): ScheduledRunTally {
  return { successfulUsers: 0, providerAttempts: 0, hadOperationalFailure: false };
}

export function addOutcome(tally: ScheduledRunTally, outcome: ScheduledUserOutcome): void {
  if (outcome.status === "failed") tally.hadOperationalFailure = true;
  if (outcome.status === "delivered") {
    tally.providerAttempts += outcome.results.length;
    if (outcome.sent) tally.successfulUsers += 1;
  }
}

/**
 * An occurrence succeeded when nothing failed operationally and, if any
 * provider was tried, at least one accepted. finish_push_schedule still keeps
 * the occurrence retryable while any recipient row is pending or failed.
 */
export function isScheduledRunSuccessful(tally: ScheduledRunTally): boolean {
  return !tally.hadOperationalFailure
    && (tally.successfulUsers > 0 || tally.providerAttempts === 0);
}

export async function finishScheduledRun(
  client: SupabaseClient,
  type: string,
  occurrenceKey: string,
  tally: ScheduledRunTally,
): Promise<boolean> {
  const succeeded = isScheduledRunSuccessful(tally);
  const { error: finishError } = await client.rpc("finish_push_schedule", {
    p_event_type: type,
    p_occurrence_key: occurrenceKey,
    p_success: succeeded,
    p_error: succeeded ? null : "no_provider_acceptance",
  });
  if (finishError) {
    logEvent("error", "push_schedule_finish_failed", { eventType: type, errorCode: finishError.code ?? "unknown" });
  }

  if (tally.successfulUsers > 0) {
    const { error: updateScheduleError } = await client
      .from("push_notification_schedules")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("event_type", type);
    if (updateScheduleError) {
      logEvent("error", "push_schedule_last_sent_update_failed", {
        eventType: type,
        errorCode: updateScheduleError.code ?? "unknown",
      });
    }
  }
  return succeeded;
}
