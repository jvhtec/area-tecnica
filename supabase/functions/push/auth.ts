import type { SupabaseClient } from "./deps.ts";
import { SERVICE_ROLE_KEY } from "./config.ts";
import { corsHeaders } from "./http.ts";
import { timingSafeEqual } from "../_shared/auth.ts";

const SERVICE_CALLER_ID = '00000000-0000-0000-0000-000000000000';

const isServiceToken = (token: string): boolean => {
  const internal = Deno.env.get('PUSH_INTERNAL_TOKEN') || '';
  return (Boolean(SERVICE_ROLE_KEY) && timingSafeEqual(token, SERVICE_ROLE_KEY))
    || (Boolean(internal) && timingSafeEqual(token, internal));
};

export async function resolveCaller(
  client: SupabaseClient,
  token: string,
  allowService = false,
): Promise<{ userId: string; isService: boolean }> {
  // Recognise the service key / internal token before asking Auth: it is not
  // a user JWT, so getUser() would only answer 403 "missing sub claim" (once
  // per cron tick).
  if (allowService && isServiceToken(token)) {
    return { userId: SERVICE_CALLER_ID, isService: true };
  }

  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user?.id) {
    return { userId: data.user.id, isService: false };
  }
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
