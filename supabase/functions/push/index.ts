import { createClient, serve } from "./deps.ts";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./config.ts";
import { resolveCaller } from "./auth.ts";
import { handleBroadcast } from "./broadcast.ts";
import { handleCheckScheduled } from "./scheduled.ts";
import { corsHeaders, ensureAuthHeader, jsonResponse } from "./http.ts";
import {
  handleSubscribe,
  handleSubscribeNative,
  handleUnsubscribe,
  handleUnsubscribeNative,
} from "./subscriptions.ts";
import { handleTest } from "./test.ts";
import type {
  Action,
  BroadcastBody,
  CheckScheduledBody,
  RequestBody,
  SubscribeBody,
  SubscribeNativeBody,
  TestBody,
  UnsubscribeBody,
  UnsubscribeNativeBody,
} from "./types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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
  // Allow service callers for broadcast and check_scheduled; user token for others
  const allowService = (body.action as Action) === 'broadcast' || (body.action as Action) === 'check_scheduled';
  const { userId } = await resolveCaller(client, token, allowService);

  switch (body.action as Action) {
    case "subscribe":
      return await handleSubscribe(client, userId, body as SubscribeBody, req);
    case "unsubscribe":
      return await handleUnsubscribe(client, userId, body as UnsubscribeBody);
    case "subscribe_native":
      return await handleSubscribeNative(client, userId, body as SubscribeNativeBody);
    case "unsubscribe_native":
      return await handleUnsubscribeNative(client, userId, body as UnsubscribeNativeBody);
    case "test":
      return await handleTest(client, userId, body as TestBody);
    case "broadcast":
      return await handleBroadcast(client, userId, body as BroadcastBody);
    case "check_scheduled":
      return await handleCheckScheduled(client, body as CheckScheduledBody);
    default:
      return jsonResponse({ error: "Unsupported action" }, 400);
  }
});
