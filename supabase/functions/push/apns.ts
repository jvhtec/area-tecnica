import { APNS_AUTH_KEY, APNS_BUNDLE_ID, APNS_ENV, APNS_KEY_ID, APNS_TEAM_ID } from "./config.ts";
import { jsonResponse } from "./http.ts";
import type { PushPayload, PushSendResult } from "./types.ts";

const APNS_HOST = APNS_ENV === "sandbox" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
const JWT_TTL_SECONDS = 50 * 60;

let cachedJwt: { token: string; issuedAt: number } | null = null;

const base64UrlEncode = (input: Uint8Array | string): string => {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const getApnsPrivateKey = (): Uint8Array | null => {
  if (!APNS_AUTH_KEY) {
    return null;
  }

  const normalized = APNS_AUTH_KEY.replace(/\\n/g, "\n");
  const cleaned = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  if (!cleaned) {
    return null;
  }

  const raw = atob(cleaned);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
};

const getApnsJwt = async (): Promise<string | null> => {
  if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.issuedAt < JWT_TTL_SECONDS) {
    return cachedJwt.token;
  }

  const header = { alg: "ES256", kid: APNS_KEY_ID };
  const payload = { iss: APNS_TEAM_ID, iat: now };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;

  const keyBytes = getApnsPrivateKey();
  if (!keyBytes) {
    return null;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  cachedJwt = { token: jwt, issuedAt: now };
  return jwt;
};

export async function sendNativePushNotification(
  client: { from: (table: string) => any },
  deviceToken: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID) {
    console.warn("⚠️ Skipping native push - APNs keys not configured");
    return { ok: false, skipped: true };
  }

  const jwt = await getApnsJwt();
  if (!jwt) {
    console.warn("⚠️ Skipping native push - APNs JWT could not be created");
    return { ok: false, skipped: true };
  }

  const apsPayload: Record<string, unknown> = {
    alert: {
      title: payload.title,
      body: payload.body ?? "",
    },
    sound: "default",
  };

  const body = {
    aps: apsPayload,
    data: {
      url: payload.url ?? "/",
      type: payload.type,
      meta: payload.meta ?? {},
    },
  };

  const response = await fetch(`${APNS_HOST}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true };
  }

  const status = response.status;
  let reason: string | undefined;
  try {
    const data = await response.json();
    reason = data?.reason;
  } catch {
    // Ignore JSON parse errors
  }

  if (status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
    try {
      await client.from("push_device_tokens").delete().eq("device_token", deviceToken);
    } catch (cleanupErr) {
      console.error("⚠️ Failed to cleanup invalid APNs token:", cleanupErr);
    }
  }

  return { ok: false, status };
}

export function apnsConfigCheck() {
  if (!APNS_AUTH_KEY || !APNS_KEY_ID || !APNS_TEAM_ID || !APNS_BUNDLE_ID) {
    return jsonResponse({ error: "APNs keys are not configured" }, 500);
  }
  return null;
}
