import type { SupabaseClient } from "../deps.ts";
import { PUSH_CONFIG } from "../config.ts";
import { sendNativePushNotification } from "../apns.ts";
import { sendPushNotification } from "../webpush.ts";
import type { NativePushTokenRow, PushPayload } from "../types.ts";
import { pushTargetFingerprint } from "../targetId.ts";
import { logEvent } from "../../_shared/structuredLogger.ts";

type BroadcastClient = SupabaseClient;

type PushSubscriptionTarget = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_id?: string | null;
};

export type DeliveryResult = {
  endpoint: string;
  userId?: string;
  channel: "webpush" | "apns";
  ok: boolean;
  status?: number;
  skipped?: boolean;
  attempts: number;
  errorCode?: string;
};

const MAX_DELIVERY_ATTEMPTS = 3;

export function isTransientDeliveryStatus(status?: number): boolean {
  return status === 408 || status === 425 || status === 429 || (typeof status === "number" && status >= 500);
}

async function pauseBeforeRetry(attempt: number, retryAfterMs?: number): Promise<void> {
  const backoff = retryAfterMs ?? Math.min(1500, 150 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
  await new Promise((resolve) => setTimeout(resolve, backoff));
}

async function runBounded<T>(tasks: Array<() => Promise<T>>, concurrency = PUSH_CONFIG.DELIVERY_CONCURRENCY): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

async function recordTargetHealth(
  client: BroadcastClient,
  channel: "webpush" | "apns",
  target: string,
  success: boolean,
): Promise<void> {
  const { error } = await client.rpc("record_push_target_health", {
    p_channel: channel,
    p_target: target,
    p_success: success,
  });
  if (error) {
    logEvent("warn", "push_target_health_persistence_failed", {
      channel,
      errorCode: error.code ?? "unknown",
    });
  }
}

export async function loadNativeTokens(
  client: BroadcastClient,
  userIds: string[],
): Promise<{ tokens: NativePushTokenRow[]; error: unknown | null }> {
  if (userIds.length === 0) {
    return { tokens: [], error: null };
  }

  const { data, error } = await client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .in("user_id", userIds)
    .eq("enabled", true)
    .returns<NativePushTokenRow[]>();

  if (error) {
    logEvent("error", "push_native_target_lookup_failed", {
      errorCode: error.code ?? "unknown",
    });
    return { tokens: [], error };
  }

  return { tokens: data ?? [], error: null };
}

export async function loadPushSubscriptions(
  client: BroadcastClient,
  userIds: string[],
): Promise<{ subscriptions: PushSubscriptionTarget[]; error: unknown | null }> {
  if (userIds.length === 0) {
    return { subscriptions: [], error: null };
  }

  const { data, error } = await client
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds)
    .eq('enabled', true);

  return {
    subscriptions: data ?? [],
    error: error ?? null,
  };
}

export async function sendPayloadToTargets(
  client: BroadcastClient,
  subscriptions: PushSubscriptionTarget[],
  nativeTokens: NativePushTokenRow[],
  payload: PushPayload,
): Promise<DeliveryResult[]> {
  const tasks: Array<() => Promise<DeliveryResult>> = [
    ...subscriptions.map((sub) => async () => {
      const targetId = await pushTargetFingerprint("webpush", sub.endpoint);
      let attempts = 0;
      while (attempts < MAX_DELIVERY_ATTEMPTS) {
        attempts += 1;
        try {
          const result = await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
          if (result.ok || "skipped" in result || !isTransientDeliveryStatus(result.status) || attempts >= MAX_DELIVERY_ATTEMPTS) {
            if (!("skipped" in result)) {
              await recordTargetHealth(client, "webpush", sub.endpoint, result.ok);
            }
            return {
              endpoint: targetId,
              userId: sub.user_id ?? undefined,
              channel: "webpush" as const,
              ok: result.ok,
              status: "status" in result ? result.status : undefined,
              skipped: "skipped" in result ? result.skipped : undefined,
              attempts,
              errorCode: !result.ok ? ("reason" in result ? result.reason : undefined) : undefined,
            };
          }
          await pauseBeforeRetry(attempts, result.retryAfterMs);
        } catch (error) {
          logEvent("warn", "push_web_delivery_exception", {
            attempt: attempts,
            errorCode: error instanceof Error ? error.name : "unknown",
          });
          if (attempts >= MAX_DELIVERY_ATTEMPTS) {
            await recordTargetHealth(client, "webpush", sub.endpoint, false);
            return {
              endpoint: targetId,
              userId: sub.user_id ?? undefined,
              channel: "webpush" as const,
              ok: false,
              attempts,
              errorCode: error instanceof Error ? error.name : "unexpected_error",
            };
          }
          await pauseBeforeRetry(attempts);
        }
      }
      throw new Error("unreachable");
    }),
    ...nativeTokens.map((tokenRow) => async () => {
      const targetId = await pushTargetFingerprint("apns", tokenRow.device_token);
      let attempts = 0;
      while (attempts < MAX_DELIVERY_ATTEMPTS) {
        attempts += 1;
        try {
          const result = await sendNativePushNotification(client, tokenRow.device_token, payload);
          if (result.ok || "skipped" in result || !isTransientDeliveryStatus(result.status) || attempts >= MAX_DELIVERY_ATTEMPTS) {
            if (!("skipped" in result)) {
              await recordTargetHealth(client, "apns", tokenRow.device_token, result.ok);
            }
            return {
              endpoint: targetId,
              userId: tokenRow.user_id,
              channel: "apns" as const,
              ok: result.ok,
              status: "status" in result ? result.status : undefined,
              skipped: "skipped" in result ? result.skipped : undefined,
              attempts,
              errorCode: !result.ok ? ("reason" in result ? result.reason : undefined) : undefined,
            };
          }
          await pauseBeforeRetry(attempts, result.retryAfterMs);
        } catch (error) {
          logEvent("warn", "push_native_delivery_exception", {
            attempt: attempts,
            errorCode: error instanceof Error ? error.name : "unknown",
          });
          if (attempts >= MAX_DELIVERY_ATTEMPTS) {
            await recordTargetHealth(client, "apns", tokenRow.device_token, false);
            return {
              endpoint: targetId,
              userId: tokenRow.user_id,
              channel: "apns" as const,
              ok: false,
              attempts,
              errorCode: error instanceof Error ? error.name : "unexpected_error",
            };
          }
          await pauseBeforeRetry(attempts);
        }
      }
      throw new Error("unreachable");
    }),
  ];

  return runBounded(tasks);
}

export async function sendPayloadToUsers(
  client: BroadcastClient,
  userIds: string[],
  payload: PushPayload,
): Promise<DeliveryResult[]> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) {
    return [];
  }

  const [{ subscriptions, error }, nativeResult] = await Promise.all([
    loadPushSubscriptions(client, uniqueUserIds),
    loadNativeTokens(client, uniqueUserIds),
  ]);

  if (error || nativeResult.error) {
    logEvent("error", "push_direct_target_lookup_failed", {
      webFailed: Boolean(error),
      nativeFailed: Boolean(nativeResult.error),
    });
  }

  if (subscriptions.length === 0 && nativeResult.tokens.length === 0) {
    return [];
  }

  return sendPayloadToTargets(client, subscriptions, nativeResult.tokens, payload);
}
