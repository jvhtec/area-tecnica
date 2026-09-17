import type { SupabaseClient } from "./deps.ts";
import { logEvent } from "../_shared/structuredLogger.ts";
import { jsonResponse } from "./http.ts";
import { sendNativePushNotification } from "./apns.ts";
import { sendPushNotification } from "./webpush.ts";
import type { SubscribeBody, SubscribeNativeBody, UnsubscribeBody, UnsubscribeNativeBody } from "./types.ts";

export async function handleSubscribe(
  client: SupabaseClient,
  userId: string,
  body: SubscribeBody,
  req: Request,
) {
  if (!body.subscription?.endpoint) {
    return jsonResponse({ error: "Missing subscription endpoint" }, 400);
  }

  const { data: existingOwner, error: ownerLookupError } = await client
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", body.subscription.endpoint)
    .maybeSingle();
  if (ownerLookupError) {
    logEvent("error", "push_subscription_owner_lookup_failed", {
      errorCode: ownerLookupError.code ?? "unknown",
    });
    return jsonResponse({ error: "No se pudo verificar la suscripción" }, 500);
  }
  if (existingOwner?.user_id && existingOwner.user_id !== userId) {
    return jsonResponse({ error: "La suscripción pertenece a otra cuenta" }, 409);
  }

  const payload = {
    user_id: userId,
    endpoint: body.subscription.endpoint,
    p256dh: body.subscription.keys?.p256dh ?? null,
    auth: body.subscription.keys?.auth ?? null,
    expiration_time: body.subscription.expirationTime ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
    device_id: body.device_id ?? null,
    device_name: body.device_name ?? null,
    enabled: true,
    sync_status: "active",
    last_verified_at: new Date().toISOString(),
    failure_count: 0,
    last_failure_at: null,
    disabled_at: null,
    last_seen_at: new Date().toISOString(),
  };

  const { error } = existingOwner
    ? await client
      .from("push_subscriptions")
      .update(payload)
      .eq("endpoint", body.subscription.endpoint)
      .eq("user_id", userId)
    : await client.from("push_subscriptions").insert(payload);

  if (error) {
    console.error("push subscribe error", error);
    const status = error.code === "23505" ? 409 : 500;
    return jsonResponse({
      error: status === 409
        ? "La suscripción pertenece a otra cuenta"
        : "Failed to persist subscription",
    }, status);
  }

  if (body.send_welcome === false) {
    return jsonResponse({ status: "subscribed", notification: "not_requested" });
  }

  const welcomeResult = await sendPushNotification(
    client,
    {
      endpoint: body.subscription.endpoint,
      p256dh: body.subscription.keys?.p256dh ?? null,
      auth: body.subscription.keys?.auth ?? null,
    },
    {
      title: "Notificaciones listas",
      body: "Ya puedes recibir avisos de Sector Pro.",
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
  client: SupabaseClient,
  userId: string,
  body: UnsubscribeBody,
) {
  if (!body.endpoint && !body.device_id) {
    return jsonResponse({ error: "Falta identificar la suscripción" }, 400);
  }

  const query = client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (body.endpoint) query.eq("endpoint", body.endpoint);
  if (body.device_id) query.eq("device_id", body.device_id);
  const { error } = await query;

  if (error) {
    console.error("push unsubscribe error", error);
    return jsonResponse({ error: "Failed to remove subscription" }, 500);
  }

  return jsonResponse({ status: "unsubscribed" });
}

export async function handleSubscribeNative(
  client: SupabaseClient,
  userId: string,
  body: SubscribeNativeBody,
) {
  if (!body.token) {
    return jsonResponse({ error: "Missing device token" }, 400);
  }

  const { data: existingOwner, error: ownerLookupError } = await client
    .from("push_device_tokens")
    .select("user_id")
    .eq("device_token", body.token)
    .maybeSingle();
  if (ownerLookupError) {
    logEvent("error", "native_push_owner_lookup_failed", {
      errorCode: ownerLookupError.code ?? "unknown",
    });
    return jsonResponse({ error: "No se pudo verificar el dispositivo" }, 500);
  }
  if (existingOwner?.user_id && existingOwner.user_id !== userId) {
    return jsonResponse({ error: "El dispositivo pertenece a otra cuenta" }, 409);
  }

  const payload = {
    user_id: userId,
    device_token: body.token,
    platform: body.platform ?? "ios",
    device_id: body.device_id ?? null,
    device_name: body.device_name ?? null,
    enabled: true,
    sync_status: "active",
    last_verified_at: new Date().toISOString(),
    failure_count: 0,
    last_failure_at: null,
    disabled_at: null,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = existingOwner
    ? await client
      .from("push_device_tokens")
      .update(payload)
      .eq("device_token", body.token)
      .eq("user_id", userId)
    : await client.from("push_device_tokens").insert(payload);

  if (error) {
    console.error("native push subscribe error", error);
    const status = error.code === "23505" ? 409 : 500;
    return jsonResponse({
      error: status === 409
        ? "El dispositivo pertenece a otra cuenta"
        : "Failed to persist device token",
    }, status);
  }

  if (body.send_welcome === false) {
    return jsonResponse({ status: "subscribed", notification: "not_requested" });
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
  client: SupabaseClient,
  userId: string,
  body: UnsubscribeNativeBody,
) {
  if (!body.token && !body.device_id) {
    return jsonResponse({ error: "Falta identificar el dispositivo" }, 400);
  }
  const query = client.from("push_device_tokens").delete().eq("user_id", userId);

  if (body.token) {
    query.eq("device_token", body.token);
  }

  if (body.platform) {
    query.eq("platform", body.platform);
  }

  if (body.device_id) {
    query.eq("device_id", body.device_id);
  }

  const { error } = await query;

  if (error) {
    console.error("native push unsubscribe error", error);
    return jsonResponse({ error: "Failed to remove device token" }, 500);
  }

  return jsonResponse({ status: "unsubscribed" });
}
