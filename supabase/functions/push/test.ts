import { createClient } from "./deps.ts";
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from "./config.ts";
import { jsonResponse } from "./http.ts";
import { sendPushNotification } from "./webpush.ts";
import type { PushSubscriptionRow, TestBody } from "./types.ts";

export async function handleTest(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: TestBody,
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse({ error: "VAPID keys are not configured" }, 500);
  }

  const { data, error } = await client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)
    .returns<PushSubscriptionRow[]>();

  if (error) {
    console.error("push test fetch error", error);
    return jsonResponse({ error: "Failed to load subscriptions" }, 500);
  }

  if (!data?.length) {
    return jsonResponse({ status: "skipped", reason: "No subscriptions found" });
  }

  const payload = {
    title: "Push notifications ready",
    body: "You'll now receive updates from Sector Pro.",
    url: body.url ?? "/",
  };

  const results: Array<{ endpoint: string; ok: boolean; status?: number; skipped?: boolean }> = [];

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

  return jsonResponse({ status: "sent", results });
}

