import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  // IPv6 literals (URL hostname keeps brackets) — block all to avoid ::1 / unique-local tricks
  if (host.startsWith("[")) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return PRIVATE_IPV4_RANGES.some((range) => range.test(host));
  }
  return false;
}

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Require an authenticated platform user
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return jsonError("Unauthorized", 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user) return jsonError("Unauthorized", 401);

    const { url } = await req.json();
    if (!url) return jsonError("URL is required", 400);

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return jsonError("Invalid URL", 400);
    }
    if (target.protocol !== "https:") {
      return jsonError("Only https URLs are allowed", 400);
    }
    if (isBlockedHost(target.hostname)) {
      return jsonError("Host not allowed", 400);
    }

    const response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return jsonError("Failed to fetch image", response.status);
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.startsWith("image/")) {
      return jsonError("URL did not return an image", 415);
    }
    const contentLength = Number(response.headers.get("Content-Length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      return jsonError("Image too large", 413);
    }

    const imageBlob = await response.blob();
    if (imageBlob.size > MAX_IMAGE_BYTES) {
      return jsonError("Image too large", 413);
    }

    return new Response(imageBlob, {
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
});
