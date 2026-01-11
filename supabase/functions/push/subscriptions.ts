import { createClient } from "./deps.ts";
import { jsonResponse } from "./http.ts";
import { sendNativePushNotification } from "./apns.ts";
import { sendPushNotification } from "./webpush.ts";
import type { SubscribeBody, SubscribeNativeBody, UnsubscribeBody, UnsubscribeNativeBody } from "./types.ts";

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

export async function handleSubscribeNative(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: SubscribeNativeBody,
) {
  if (!body.token) {
    return jsonResponse({ error: "Missing device token" }, 400);
  }

  const payload = {
    user_id: userId,
    device_token: body.token,
    platform: body.platform ?? "ios",
    device_id: body.device_id ?? null,
    device_name: body.device_name ?? null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from("push_device_tokens")
    .upsert(payload, { onConflict: "device_token" });

  if (error) {
    console.error("native push subscribe error", error);
    return jsonResponse({ error: "Failed to persist device token" }, 500);
  }

  const welcomeResult = await sendNativePushNotification(
    client,
    body.token,
    {
      title: "Notificaciones listas",
      body: "Ya puedes recibir avisos en tu iPhone.",
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

export async function handleUnsubscribeNative(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: UnsubscribeNativeBody,
) {
  const query = client.from("push_device_tokens").delete().eq("user_id", userId);

  if (body.token) {
    query.eq("device_token", body.token);
  }

  if (body.platform) {
    query.eq("platform", body.platform);
  }

  const { error } = await query;

  if (error) {
    console.error("native push unsubscribe error", error);
    return jsonResponse({ error: "Failed to remove device token" }, 500);
  }

  return jsonResponse({ status: "unsubscribed" });
}
