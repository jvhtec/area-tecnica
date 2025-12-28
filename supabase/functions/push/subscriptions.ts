import { createClient } from "./deps.ts";
import { jsonResponse } from "./http.ts";
import { sendPushNotification } from "./webpush.ts";
import type { SubscribeBody, UnsubscribeBody } from "./types.ts";

export async function handleSubscribe(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: SubscribeBody,
  req: Request,
) {
  if (!body.subscription?.endpoint) {
    return jsonResponse({ error: "Missing subscription endpoint" }, 400);
  }

  const payload = {
    user_id: userId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys?.p256dh ?? null,
    auth: body.subscription.keys?.auth ?? null,
    expiration_time: body.subscription.expirationTime ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("push_subscriptions")
    .upsert(payload, { onConflict: "endpoint" });

  if (error) {
    console.error("push subscribe error", error);
    return jsonResponse({ error: "Failed to persist subscription" }, 500);
  }

  const welcomeResult = await sendPushNotification(
    client,
    {
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys?.p256dh ?? null,
      auth: body.subscription.keys?.auth ?? null,
    },
    {
      title: "Push notifications ready",
      body: "You'll now receive updates from Sector Pro.",
      url: "/",
      type: "welcome",
    },
  );

  const notificationStatus = welcomeResult.ok
    ? "sent"
    : "skipped" in welcomeResult
      ? "skipped"
      : "failed";

  return jsonResponse({
    status: "subscribed",
    notification: notificationStatus,
    errorCode:
      welcomeResult.ok || "skipped" in welcomeResult
        ? undefined
        : welcomeResult.status,
  });
}

export async function handleUnsubscribe(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: UnsubscribeBody,
) {
  if (!body.endpoint) {
    return jsonResponse({ error: "Missing endpoint" }, 400);
  }

  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", body.endpoint);

  if (error) {
    console.error("push unsubscribe error", error);
    return jsonResponse({ error: "Failed to remove subscription" }, 500);
  }

  return jsonResponse({ status: "unsubscribed" });
}

