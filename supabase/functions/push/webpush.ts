import { createClient, webpush } from "./deps.ts";
import { CONTACT_EMAIL, PUSH_CONFIG, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY } from "./config.ts";
import type { PushPayload, PushSendResult, PushSubscriptionRow } from "./types.ts";

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
    console.warn("⚠️ Push missing keys for endpoint", subscription.endpoint);
    return { ok: false, skipped: true };
  }

  console.log('📤 Sending push notification:', {
    endpoint: subscription.endpoint.substring(0, 50) + '...',
    title: payload.title,
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
    const status = (err as any)?.statusCode ?? (err as any)?.status ?? 500;
    console.error('❌ Push send error:', {
      status,
      message: (err as any)?.message,
      body: (err as any)?.body,
      endpoint: subscription.endpoint.substring(0, 50) + '...',
      error: err
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

