import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? "";
const WALLBOARD_SERVICE_EMAIL = Deno.env.get("WALLBOARD_SERVICE_EMAIL") ?? "";
const WALLBOARD_SERVICE_PASSWORD = Deno.env.get("WALLBOARD_SERVICE_PASSWORD") ?? "";
const DEFAULT_TTL_SECONDS = parseInt(Deno.env.get("WALLBOARD_JWT_TTL") ?? "900", 10); // 15 minutes

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
}

const supabase = SUPABASE_URL && SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

async function createWallboardSession() {
  if (!supabase) {
    throw new Error("Supabase configuration is missing");
  }
  if (!WALLBOARD_SERVICE_EMAIL || !WALLBOARD_SERVICE_PASSWORD) {
    throw new Error("Wallboard service credentials are not configured");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: WALLBOARD_SERVICE_EMAIL,
    password: WALLBOARD_SERVICE_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? "Unable to authenticate wallboard session");
  }

  const { session } = data;
  const expiresIn = session.expires_in ?? DEFAULT_TTL_SECONDS;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("wallboardToken");
    if (!token) {
      const rawBody = (await req.text()).trim();
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody);
          const candidate =
            typeof parsed === "string"
              ? parsed
              : typeof parsed === "object" && parsed
                ? (parsed as Record<string, unknown>).token ??
                  (parsed as Record<string, unknown>).accessToken ??
                  (parsed as Record<string, unknown>).wallboardToken ??
                  (parsed as Record<string, unknown>).sharedToken ??
                  null
                : null;
          if (typeof candidate === "string") {
            token = candidate;
          }
        } catch (_) {
          token = rawBody;
        }
      }
    }
    if (!token || token !== WALLBOARD_SHARED_TOKEN) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors() });
    }

    const { accessToken, refreshToken, expiresIn } = await createWallboardSession();

    return new Response(JSON.stringify({ token: accessToken, refreshToken, expiresIn }), {
      headers: { "Content-Type": "application/json", ...cors() },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors() },
    });
  }
});

