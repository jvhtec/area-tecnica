import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  corsHeaders,
  createHttpHandler,
  HttpError,
  jsonResponse,
  requireEnvValues,
} from "../_shared/http.ts";
import { resolveHojaAttachment } from "../_shared/hojaAttachment.ts";
import {
  getJobHojaLinkSecret,
  verifyJobHojaLink,
} from "../_shared/hojaLinkToken.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const INGRESS_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const INGRESS_RATE_LIMIT_MAX_REQUESTS = 300;
const TOKEN_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const TOKEN_RATE_LIMIT_MAX_REQUESTS = 120;

function parseExpiresAt(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return NaN;
  return Number.parseInt(value, 10);
}

serve(createHttpHandler(async (req: Request) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, Deno.env.get);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const rateLimitSalt = Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? SUPABASE_SERVICE_ROLE_KEY;

  const ingressRateLimit = await checkEdgeRateLimit({
    req,
    supabase,
    scope: "job-hoja-de-ruta-link.ingress",
    identifierParts: ["document"],
    windowSeconds: INGRESS_RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: INGRESS_RATE_LIMIT_MAX_REQUESTS,
    salt: rateLimitSalt,
  });

  if (!ingressRateLimit.allowed) {
    return jsonResponse(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(ingressRateLimit) },
    );
  }

  const url = new URL(req.url);
  const jobId = (url.searchParams.get("job_id") || "").trim();
  const expiresAt = parseExpiresAt(url.searchParams.get("exp"));
  const token = (url.searchParams.get("t") || "").trim();

  if (!jobId || !Number.isFinite(expiresAt) || !token) {
    throw new HttpError(400, "Invalid Hoja de Ruta link", { code: "invalid_hoja_link" });
  }

  const secret = getJobHojaLinkSecret(Deno.env.get);
  const valid = await verifyJobHojaLink({
    jobId,
    expiresAt,
    token,
    secret,
  });

  if (!valid) {
    throw new HttpError(404, "Hoja de Ruta link not found or expired", { code: "hoja_link_not_found" });
  }

  const tokenRateLimit = await checkEdgeRateLimit({
    req,
    supabase,
    scope: "job-hoja-de-ruta-link",
    identifierParts: [jobId, token],
    windowSeconds: TOKEN_RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: TOKEN_RATE_LIMIT_MAX_REQUESTS,
    includeIp: false,
    includeUserAgent: false,
    salt: rateLimitSalt,
  });

  if (!tokenRateLimit.allowed) {
    return jsonResponse(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(tokenRateLimit) },
    );
  }

  const doc = await resolveHojaAttachment(supabase, jobId);
  if (!doc) {
    throw new HttpError(404, "Hoja de Ruta not found", { code: "hoja_de_ruta_not_found" });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(doc.bucket)
    .createSignedUrl(doc.path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error("Failed to sign latest Hoja de Ruta URL:", signError);
    throw new HttpError(500, "Unable to create Hoja de Ruta link", {
      code: "hoja_de_ruta_sign_failed",
      exposeDetails: false,
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      Location: signed.signedUrl,
    },
  });
}, { allowedMethods: ["GET"] }));
