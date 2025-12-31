import { createClient } from "./deps.ts";
import { SERVICE_ROLE_KEY } from "./config.ts";
import { corsHeaders } from "./http.ts";

export async function resolveCaller(
  client: ReturnType<typeof createClient>,
  token: string,
  allowService = false,
): Promise<{ userId: string; isService: boolean }> {
  // Try user token
  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user?.id) {
    return { userId: data.user.id, isService: false };
  }
  // Allow service key / internal token for server-initiated broadcasts
  const internal = Deno.env.get('PUSH_INTERNAL_TOKEN') || '';
  if (allowService && (token === SERVICE_ROLE_KEY || (internal && token === internal))) {
    return { userId: '00000000-0000-0000-0000-000000000000', isService: true };
  }
  throw new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

