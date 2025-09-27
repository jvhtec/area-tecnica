import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? "";
const WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? "";
const DEFAULT_TTL_SECONDS = parseInt(Deno.env.get("WALLBOARD_JWT_TTL") ?? "900", 10); // 15 minutes

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  } as Record<string, string>;
}

async function sign(payload: Payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WALLBOARD_JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const header: Header = { alg: "HS256", typ: "JWT" };
  return await create(header, payload, key);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("wallboardToken") || (await req.text()).trim();
    if (!token || token !== WALLBOARD_SHARED_TOKEN) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors() });
    }
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(60, DEFAULT_TTL_SECONDS);
    const jwt = await sign({
      iss: "wallboard-auth",
      iat: now,
      exp: getNumericDate(ttl),
      scope: "wallboard",
    });
    return new Response(JSON.stringify({ token: jwt, expiresIn: ttl }), {
      headers: { "Content-Type": "application/json", ...cors() },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors() },
    });
  }
});

