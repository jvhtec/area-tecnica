import { createClient, serve } from "./deps.ts";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./config.ts";
import { createHttpHandler, HttpError, readJsonBody } from "../_shared/http.ts";
import { resolveCaller } from "./auth.ts";
import { authorizeBroadcast } from "./authorization.ts";
import { handleBroadcast } from "./broadcast.ts";
import { handleCheckScheduled } from "./scheduled.ts";
import { ensureAuthHeader, jsonResponse } from "./http.ts";
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

serve(createHttpHandler(async (req) => {
  const body = await readJsonBody<RequestBody>(req);
  if (!body?.action) {
    throw new HttpError(400, "Missing action");
  }

  const token = ensureAuthHeader(req);
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  // Allow service callers for broadcast and check_scheduled; user token for others
  const allowService = (body.action as Action) === 'broadcast' || (body.action as Action) === 'check_scheduled';
  const caller = await resolveCaller(client, token, allowService);
  const { userId } = caller;

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
      await authorizeBroadcast(client, caller, body as BroadcastBody);
      return await handleBroadcast(client, userId, body as BroadcastBody);
    case "check_scheduled":
      if (!caller.isService) {
        throw new HttpError(403, "La ejecución programada requiere autenticación de servicio");
      }
      return await handleCheckScheduled(client, body as CheckScheduledBody);
    default:
      return jsonResponse({ error: "Unsupported action" }, 400);
  }
}, {
  allowedMethods: ["POST"],
  methodNotAllowedStatus: 404,
  methodNotAllowedBody: { error: "Not found" },
  onError: (error) => console.error("push request error", error),
}));
