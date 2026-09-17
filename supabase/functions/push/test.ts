import type { SupabaseClient } from "./deps.ts";
import { jsonResponse } from "./http.ts";
import type { NativePushTokenRow, TestBody } from "./types.ts";
import { sendPayloadToTargets } from "./broadcast/delivery.ts";
import { validateInternalUrl } from "./urls.ts";

export async function handleTest(
  client: SupabaseClient,
  userId: string,
  body: TestBody,
) {
  let webQuery = client
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (body.device_id) webQuery = webQuery.eq("device_id", body.device_id);
  const { data, error } = await webQuery;

  if (error) {
    console.error("push test fetch error", error);
    return jsonResponse({ error: "Failed to load subscriptions" }, 500);
  }

  let nativeQuery = client
    .from("push_device_tokens")
    .select("user_id, device_token, platform")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (body.device_id) nativeQuery = nativeQuery.eq("device_id", body.device_id);
  const { data: nativeTokens, error: nativeErr } = await nativeQuery.returns<NativePushTokenRow[]>();

  if (nativeErr) {
    console.error("native push test fetch error", nativeErr);
    return jsonResponse({ error: "Failed to load native tokens" }, 500);
  }

  if (!data?.length && !nativeTokens?.length) {
    return jsonResponse({ status: "skipped", reason: "No subscriptions found" });
  }

  const payload = {
    title: "Notificaciones listas",
    body: "Esta prueba confirma que el servicio push ha aceptado el aviso.",
    url: validateInternalUrl(body.url) || "/notifications?section=diagnostics",
    type: "test",
    urgency: "normal" as const,
    ttlSeconds: 300,
    meta: { tag: `push-test:${body.device_id || userId}`, renotify: false },
  };

  const results = await sendPayloadToTargets(client, data ?? [], nativeTokens ?? [], payload);
  const accepted = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok && !result.skipped).length;
  return jsonResponse({
    status: accepted > 0 ? (failed > 0 ? "partial" : "accepted") : failed > 0 ? "failed" : "skipped",
    outcomes: { accepted, failed, skipped: results.length - accepted - failed },
    results,
  }, accepted === 0 && failed > 0 ? 502 : 200);
}
