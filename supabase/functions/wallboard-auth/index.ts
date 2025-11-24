import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { create, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

// Allow fallbacks for local/dev to avoid runtime crashes; prod should set both env vars
const FALLBACK_SHARED_TOKEN = Deno.env.get("VITE_WALLBOARD_TOKEN") ?? "demo-wallboard-token";
const WALLBOARD_SHARED_TOKEN = Deno.env.get("WALLBOARD_SHARED_TOKEN") ?? FALLBACK_SHARED_TOKEN;
const WALLBOARD_JWT_SECRET = Deno.env.get("WALLBOARD_JWT_SECRET") ?? "wallboard-dev-secret";
const WALLBOARD_PRESET_SLUG = Deno.env.get("WALLBOARD_PRESET_SLUG") ?? "almacen";
const missingSecrets = [
  !WALLBOARD_SHARED_TOKEN && "WALLBOARD_SHARED_TOKEN",
  !WALLBOARD_JWT_SECRET && "WALLBOARD_JWT_SECRET",
].filter(Boolean) as string[];

if (missingSecrets.length > 0) {
  console.error(
    `Missing required wallboard auth secrets: ${missingSecrets.join(", ")}. Using fallbacks; set env vars in production.`
  );
}
const MIN_TTL_SECONDS = 8 * 60 * 60; // 8 hours minimum
const envTtl = parseInt(Deno.env.get("WALLBOARD_JWT_TTL") ?? '', 10);
const DEFAULT_TTL_SECONDS = Number.isFinite(envTtl) ? envTtl : MIN_TTL_SECONDS;

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    let presetFromReq = (url.searchParams.get("presetSlug") ?? url.searchParams.get("preset") ?? "").trim().toLowerCase();
    let token = url.searchParams.get("wallboardToken");

    console.log("🔐 wallboard-auth request:", {
      method: req.method,
      presetFromUrl: presetFromReq || "(none)",
      hasTokenInUrl: !!token,
    });

    if (!token) {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => null);
        console.log("📦 Request body:", {
          hasWallboardToken: !!body?.wallboardToken,
          hasToken: !!body?.token,
          presetSlugFromBody: body?.presetSlug || "(none)",
          presetFromBody: body?.preset || "(none)",
        });
        token = body?.wallboardToken || body?.token || null;
        if (!presetFromReq) {
          const rawPreset = body?.presetSlug || body?.preset || "";
          if (typeof rawPreset === "string") {
            presetFromReq = rawPreset.trim().toLowerCase();
          }
        }
      }
    }
    if (!token) {
      const raw = (await req.text()).trim();
      if (raw) token = raw;
    }
    if (!token || token !== WALLBOARD_SHARED_TOKEN) {
      console.warn("❌ Token mismatch or missing");
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors() });
    }
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(MIN_TTL_SECONDS, DEFAULT_TTL_SECONDS);
    const preset = presetFromReq || WALLBOARD_PRESET_SLUG || "default";

    console.log("✅ Generating JWT with preset:", {
      presetFromReq: presetFromReq || "(none)",
      fallbackEnv: WALLBOARD_PRESET_SLUG,
      finalPreset: preset,
    });

    const jwt = await sign({
      iss: "wallboard-auth",
      iat: now,
      exp: getNumericDate(ttl),
      scope: "wallboard",
      preset,
    });
    return new Response(JSON.stringify({ token: jwt, expiresIn: ttl, preset }), {
      headers: { "Content-Type": "application/json", ...cors() },
    });
  } catch (e: any) {
    console.error("🔥 wallboard-auth error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors() },
    });
  }
});
