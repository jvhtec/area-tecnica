import { logEvent } from "./structuredLogger.ts";

export type PushBroadcastPayload = Record<string, unknown> & { type: string };

/**
 * Emits a push broadcast from a server-side function using the service role.
 *
 * Push delivery is always secondary to whatever the caller is really doing (a
 * decision, an email, a status change), so this never throws and never blocks
 * that work: a failure is logged and swallowed. Callers that must not wait on
 * the network should start the promise and await it at their return site rather
 * than at the call site, so the isolate does not shut down mid-flight.
 */
export async function broadcastPush(
  payload: PushBroadcastPayload,
  options: { supabaseUrl?: string; serviceRoleKey?: string } = {},
): Promise<boolean> {
  const supabaseUrl = options.supabaseUrl ?? Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = options.serviceRoleKey
    ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    logEvent("warn", "push_broadcast_not_configured", { eventType: payload.type });
    return false;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ action: "broadcast", ...payload }),
    });
    if (!response.ok) {
      logEvent("warn", "push_broadcast_rejected", {
        eventType: payload.type,
        status: response.status,
      });
      return false;
    }
    // Drain the body so the connection is released promptly.
    await response.body?.cancel();
    return true;
  } catch (error) {
    logEvent("warn", "push_broadcast_failed", {
      eventType: payload.type,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
