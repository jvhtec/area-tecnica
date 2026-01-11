import { createClient } from "./deps.ts";
import { jsonResponse } from "./http.ts";
import { sendNativePushNotification } from "./apns.ts";
import { sendPushNotification } from "./webpush.ts";
import type { NativePushTokenRow, PushSubscriptionRow, TestBody } from "./types.ts";

export async function handleTest(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: TestBody,
) {
  const { data, error } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .returns<PushSubscriptionRow[]>();

  if (error) {
    console.error("push test fetch error", error);
    return jsonResponse({ error: "Failed to load subscriptions" }, 500);
  }

  const { data: nativeTokens, error: nativeErr } = await client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .eq("user_id", userId)
    .returns<NativePushTokenRow[]>();

  if (nativeErr) {
    console.error("native push test fetch error", nativeErr);
    return jsonResponse({ error: "Failed to load native tokens" }, 500);
  }

  if (!data?.length && !nativeTokens?.length) {
    return jsonResponse({ status: "skipped", reason: "No subscriptions found" });
  }

  const payload = {
    title: "Push notifications ready",
    body: "You'll now receive updates from Sector Pro.",
    url: body.url ?? "/",
  };

  const results: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean }> = [];

  if (data?.length) {
    await Promise.all(
      data.map(async (sub) => {
        const result = await sendPushNotification(client, sub, payload);
        results.push({
          endpoint: sub.endpoint,
          ok: result.ok,
          status: "status" in result ? result.status : undefined,
          skipped: "skipped" in result ? result.skipped : undefined,
        });
      }),
    );
  }

  if (nativeTokens?.length) {
    await Promise.all(
      nativeTokens.map(async (tokenRow) => {
        const result = await sendNativePushNotification(client, tokenRow.device_token, payload);
        results.push({
          endpoint: `apns:${tokenRow.device_token}`,
          ok: result.ok,
          status: "status" in result ? result.status : undefined,
          skipped: "skipped" in result ? result.skipped : undefined,
        });
      }),
    );
  }

  return jsonResponse({ status: "sent", results });
}
