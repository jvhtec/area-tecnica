import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";

const SIGNED_URL_TTL_SECONDS = 300;
const INGRESS_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const INGRESS_RATE_LIMIT_MAX_REQUESTS = 300;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_MAX_REQUESTS = 120;
const MAX_JSON_BODY_BYTES = 32 * 1024;

const sha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));
  const rateLimitSalt = Deno.env.get("EDGE_RATE_LIMIT_HASH_SECRET") ?? SUPABASE_SERVICE_ROLE_KEY;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ingressRateLimit = await checkEdgeRateLimit({
    req,
    supabase,
    scope: "tour-guest-document-url.ingress",
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

  let body: { token?: unknown; documentId?: unknown };
  try {
    body = await readBoundedJsonObject<Record<string, unknown>>(req, {
      maxBytes: MAX_JSON_BODY_BYTES,
    });
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) {
      return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
    }
    throw error;
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";

  if (!token || !documentId) {
    return jsonResponse({ error: "Missing token or documentId" }, { status: 400 });
  }

  const tokenHash = await sha256Hex(token);
  const rateLimit = await checkEdgeRateLimit({
    req,
    supabase,
    scope: "tour-guest-document-url",
    identifierParts: [tokenHash, documentId],
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    includeIp: false,
    includeUserAgent: false,
    salt: rateLimitSalt,
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  const { data: link, error: linkError } = await supabase
    .from("tour_guest_links")
    .select("id, tour_id, allowed_sections, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (linkError) {
    console.error("Unable to validate tour guest link:", linkError);
    return jsonResponse({ error: "Unable to validate link" }, { status: 500 });
  }

  const isExpired = link?.expires_at ? new Date(link.expires_at).getTime() <= Date.now() : false;
  const allowsDocuments = (link?.allowed_sections as Record<string, unknown> | null)?.documents !== false;
  if (!link || link.revoked_at || isExpired || !allowsDocuments) {
    return jsonResponse({ error: "Link not found or expired" }, { status: 404 });
  }

  const { data: document, error: documentError } = await supabase
    .from("tour_documents")
    .select("id, tour_id, file_path, visible_to_guest")
    .eq("id", documentId)
    .eq("tour_id", link.tour_id)
    .maybeSingle();

  if (documentError) {
    console.error("Unable to load tour guest document:", documentError);
    return jsonResponse({ error: "Unable to load document" }, { status: 500 });
  }

  if (!document?.visible_to_guest || !document.file_path) {
    return jsonResponse({ error: "Document not found" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("tour-documents")
    .createSignedUrl(document.file_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    console.error("Unable to sign guest document URL:", signedError);
    return jsonResponse({ error: "Unable to create document URL" }, { status: 500 });
  }

  return jsonResponse({
    signedUrl: signed.signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });
}, {
  allowedMethods: ["POST"],
  methodNotAllowedBody: { error: "Method not allowed" },
}));
