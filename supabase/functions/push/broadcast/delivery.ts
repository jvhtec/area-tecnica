import type { createClient } from "../deps.ts";
import { sendNativePushNotification } from "../apns.ts";
import { sendPushNotification } from "../webpush.ts";
import type { NativePushTokenRow, PushPayload } from "../types.ts";
import { pushTargetFingerprint } from "../targetId.ts";

type BroadcastClient = ReturnType<typeof createClient>;

type PushSubscriptionTarget = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  user_id?: string | null;
};

export type DeliveryResult = {
  endpoint: string;
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
};

export async function loadNativeTokens(
  client: BroadcastClient,
  userIds: string[],
): Promise<NativePushTokenRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .in("user_id", userIds)
    .returns<NativePushTokenRow[]>();

  if (error) {
    console.error("push broadcast fetch native tokens error", error);
    return [];
  }

  return data ?? [];
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
    .in('user_id', userIds);

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
  const results: DeliveryResult[] = [];

  await Promise.all([
    ...subscriptions.map(async (sub) => {
      const targetId = await pushTargetFingerprint("webpush", sub.endpoint);
      try {
        const result = await sendPushNotification(client, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
        results.push({
          endpoint: targetId,
          ok: result.ok,
          status: 'status' in result ? result.status : undefined,
          skipped: 'skipped' in result ? result.skipped : undefined,
        });
      } catch (error) {
        console.error('push broadcast web delivery error', { targetId, error });
        results.push({
          endpoint: targetId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
    ...nativeTokens.map(async (tokenRow) => {
      const targetId = await pushTargetFingerprint("apns", tokenRow.device_token);
      try {
        const result = await sendNativePushNotification(client, tokenRow.device_token, payload);
        results.push({
          endpoint: targetId,
          ok: result.ok,
          status: 'status' in result ? result.status : undefined,
          skipped: 'skipped' in result ? result.skipped : undefined,
        });
      } catch (error) {
        console.error('push broadcast native delivery error', { targetId, error });
        results.push({
          endpoint: targetId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  ]);

  return results;
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

  const [{ subscriptions, error }, nativeTokens] = await Promise.all([
    loadPushSubscriptions(client, uniqueUserIds),
    loadNativeTokens(client, uniqueUserIds),
  ]);

  if (error) {
    console.error('push broadcast fetch direct recipient subscriptions error', error);
  }

  if (subscriptions.length === 0 && nativeTokens.length === 0) {
    return [];
  }

  return sendPayloadToTargets(client, subscriptions, nativeTokens, payload);
}
