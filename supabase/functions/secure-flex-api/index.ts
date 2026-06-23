import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { fetchWithRetry } from "../_shared/flexFetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with, accept, prefer, x-supabase-info, x-supabase-api-version, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const FLEX_API_BASE_URL =
  Deno.env.get("FLEX_API_BASE_URL") ||
  "https://sectorpro.flexrentalsolutions.com/f5/api";
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_PATH_PREFIXES = [
  "/element",
  "/line-item",
  "/financial-document-line-item",
];
const ALLOWED_FORWARD_HEADERS = new Set([
  "accept",
  "content-type",
  "x-api-client",
  "x-requested-with",
]);
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_BODY_LENGTH = 1_000_000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateEndpoint(endpoint: unknown): URL {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
    throw new Error("Endpoint must be a relative Flex API path");
  }
  if (
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    endpoint.startsWith("//") ||
    endpoint.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(endpoint)
  ) {
    throw new Error("Invalid Flex API endpoint");
  }

  const baseUrl = new URL(FLEX_API_BASE_URL);
  const basePath = baseUrl.pathname.replace(/\/$/, "");
  const target = new URL(`${basePath}${endpoint}`, baseUrl.origin);

  if (
    target.origin !== baseUrl.origin ||
    !target.pathname.startsWith(`${basePath}/`)
  ) {
    throw new Error("Flex API endpoint escaped the configured base path");
  }

  const relativePath = target.pathname.slice(basePath.length);
  if (
    !ALLOWED_PATH_PREFIXES.some(
      (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
    )
  ) {
    throw new Error("Flex API endpoint is not allowlisted");
  }

  return target;
}

function sanitizeHeaders(input: unknown): Headers {
  const output = new Headers();

  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [key, value] of Object.entries(input)) {
      const normalized = key.toLowerCase();
      if (ALLOWED_FORWARD_HEADERS.has(normalized) && typeof value === "string") {
        output.set(key, value.slice(0, 1_000));
      }
    }
  }

  if (!output.has("Accept")) {
    output.set("Accept", "application/json");
  }

  return output;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const flexAuthToken =
      Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN");

    if (!supabaseUrl || !serviceRoleKey || !flexAuthToken) {
      console.error("secure-flex-api is missing required environment variables");
      return jsonResponse({ success: false, error: "Service unavailable" }, 503);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ success: false, error: "Authentication required" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const accessToken = authHeader.slice("Bearer ".length);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse({ success: false, error: "Invalid authentication" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("secure-flex-api profile lookup failed", profileError);
      return jsonResponse({ success: false, error: "Authorization check failed" }, 500);
    }
    if (!profile || !["admin", "management"].includes(profile.role)) {
      return jsonResponse({ success: false, error: "Insufficient permissions" }, 403);
    }

    const requestBody = await req.json().catch(() => null);
    if (!requestBody || typeof requestBody !== "object") {
      return jsonResponse({ success: false, error: "Invalid request body" }, 400);
    }

    const method = String(requestBody.method || "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      return jsonResponse({ success: false, error: "Flex API method is not allowed" }, 400);
    }

    const target = validateEndpoint(requestBody.endpoint);
    const body = requestBody.body;
    if (body !== undefined && typeof body !== "string") {
      return jsonResponse({ success: false, error: "Flex API body must be a string" }, 400);
    }
    if (typeof body === "string" && body.length > MAX_BODY_LENGTH) {
      return jsonResponse({ success: false, error: "Flex API body is too large" }, 413);
    }
    if (["GET", "DELETE"].includes(method) && body) {
      return jsonResponse(
        { success: false, error: `${method} requests may not include a body` },
        400,
      );
    }

    const headers = sanitizeHeaders(requestBody.headers);
    headers.set("X-Auth-Token", flexAuthToken);
    headers.set("apikey", flexAuthToken);

    const shouldRetry = method === "GET";
    const response = await fetchWithRetry(
      target.toString(),
      {
        method,
        headers,
        body: body || undefined,
      },
      {
        attempts: shouldRetry ? 3 : 1,
        retryOnTimeout: shouldRetry,
      },
    );

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    let data: unknown;

    if (rawBody && contentType.includes("json")) {
      try {
        data = JSON.parse(rawBody);
      } catch (parseError) {
        console.warn("secure-flex-api upstream returned invalid JSON", parseError);
        data = rawBody;
      }
    }

    if (method !== "GET" || !response.ok) {
      const { error: auditError } = await supabase.from("security_audit_log").insert({
        user_id: user.id,
        action: "flex_api_proxy",
        resource: `flex:${target.pathname.slice(0, 240)}`,
        severity: response.ok ? "low" : "medium",
        metadata: {
          method,
          status: response.status,
          success: response.ok,
        },
      });
      if (auditError) {
        console.error("secure-flex-api audit write failed", auditError);
      }
    }

    return jsonResponse({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      data,
      rawBody: data === undefined ? rawBody : undefined,
      error: response.ok
        ? undefined
        : (
          data && typeof data === "object" &&
            "exceptionMessage" in data
            ? String((data as { exceptionMessage?: unknown }).exceptionMessage)
            : `Flex API returned ${response.status}`
        ),
    });
  } catch (error) {
    console.error("secure-flex-api request failed", error);
    const message = error instanceof Error ? error.message : "Invalid request";
    return jsonResponse({ success: false, error: message }, 400);
  }
});
