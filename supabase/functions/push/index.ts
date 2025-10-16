import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Action = "subscribe" | "unsubscribe" | "test";

type SubscribeBody = {
  action: "subscribe";
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: { p256dh?: string; auth?: string };
  };
};

type UnsubscribeBody = {
  action: "unsubscribe";
  endpoint: string;
};

type TestBody = {
  action: "test";
  url?: string;
};

type RequestBody = SubscribeBody | UnsubscribeBody | TestBody;

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const CONTACT_EMAIL = Deno.env.get("PUSH_CONTACT_EMAIL") ?? "mailto:dev@sectorpro.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function ensureAuthHeader(req: Request) {
  const header = req.headers.get("Authorization");
  if (!header) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return header.replace("Bearer ", "").trim();
}

async function getUserId(client: ReturnType<typeof createClient>, token: string) {
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  return data.user.id;
}

async function handleSubscribe(
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

  return jsonResponse({ status: "subscribed" });
}

async function handleUnsubscribe(
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

async function handleTest(
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

  const results: Array<{ endpoint: string; ok: boolean; status?: number }> = [];

  await Promise.all(
    data.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh ?? "", auth: sub.auth ?? "" },
          },
          JSON.stringify(payload),
          { TTL: 60 },
        );
        results.push({ endpoint: sub.endpoint, ok: true });
      } catch (err) {
        const status = (err as any)?.statusCode ?? (err as any)?.status ?? 500;
        console.error("push test send error", err);
        results.push({ endpoint: sub.endpoint, ok: false, status });

        if (status === 404 || status === 410) {
          await client.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }),
  );

  return jsonResponse({ status: "sent", results });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  let body: RequestBody;

  try {
    body = await req.json();
  } catch (error) {
    console.error("push parse error", error);
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body?.action) {
    return jsonResponse({ error: "Missing action" }, 400);
  }

  const token = ensureAuthHeader(req);
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const userId = await getUserId(client, token);

  switch (body.action as Action) {
    case "subscribe":
      return await handleSubscribe(client, userId, body as SubscribeBody, req);
    case "unsubscribe":
      return await handleUnsubscribe(client, userId, body as UnsubscribeBody);
    case "test":
      return await handleTest(client, userId, body as TestBody);
    default:
      return jsonResponse({ error: "Unsupported action" }, 400);
  }
});
