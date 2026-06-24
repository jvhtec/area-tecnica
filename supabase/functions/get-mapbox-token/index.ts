import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { createHttpHandler, HttpError, jsonResponse, requireEnvValues } from "../_shared/http.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_REQUESTS = 120;

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    MAPBOX_PUBLIC_TOKEN: mapboxToken,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MAPBOX_PUBLIC_TOKEN"] as const,
    (name) => Deno.env.get(name),
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const rateLimit = await checkEdgeRateLimit({
    req,
    supabase,
    scope: "get-mapbox-token",
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    salt: Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? serviceRoleKey,
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  return jsonResponse({ token: mapboxToken });
}, {
  allowedMethods: ["GET", "POST"],
  internalErrorMessage: "Failed to load Mapbox token",
  onError: (error) => {
    if (!(error instanceof HttpError)) {
      console.error("Error fetching Mapbox token:", error);
    }
  },
}));
