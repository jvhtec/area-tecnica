import { createClient, webpush } from "./deps.ts";
import { CONTACT_EMAIL, PUSH_CONFIG, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from "./config.ts";
import type { PushPayload, PushSendResult, PushSubscriptionRow } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

console.log('🔐 VAPID keys loaded:', {
  publicKeyPresent: !!VAPID_PUBLIC_KEY,
  privateKeyPresent: !!VAPID_PRIVATE_KEY,
  publicKeyLength: VAPID_PUBLIC_KEY?.length || 0,
  privateKeyLength: VAPID_PRIVATE_KEY?.length || 0
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('✅ VAPID details configured for webpush');
} else {
  console.error('❌ Missing VAPID keys - push notifications will be skipped');
}

export async function sendPushNotification(
  client: ReturnType<typeof createClient>,
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('⚠️ Skipping push - VAPID keys not configured');
    return { ok: false, skipped: true };
  }

  if (!subscription.p256dh || !subscription.auth) {
    console.warn("⚠️ Push subscription is missing encryption keys");
    return { ok: false, skipped: true };
  }

  console.log('📤 Sending push notification:', {
    hasBody: !!payload.body
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      {
        TTL: PUSH_CONFIG.TTL_SECONDS,
        urgency: PUSH_CONFIG.URGENCY_HIGH,
      },
    );

    console.log('✅ Push notification sent successfully');
    return { ok: true };
  } catch (err) {
    const errorInfo = isRecord(err) ? err : {};
    const status = numberFromUnknown(errorInfo.statusCode) ?? numberFromUnknown(errorInfo.status) ?? 500;
    console.error('❌ Push send error:', {
      status,
      errorType: err instanceof Error ? err.name : "unknown",
    });

    // Clean up expired/invalid subscriptions (410 Gone, 404 Not Found)
    if (status === 404 || status === 410) {
      console.log('🗑️ Cleaning up expired subscription');
      try {
        await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      } catch (cleanupErr) {
        console.error('⚠️ Failed to cleanup subscription:', cleanupErr);
        // Don't fail the whole operation if cleanup fails
      }
    }

    return { ok: false, status };
  }
}
