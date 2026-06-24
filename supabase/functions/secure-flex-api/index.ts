import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireAdminOrManagement } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";

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

interface FlexProxyRequest extends Record<string, unknown> {
  method?: unknown;
  endpoint?: unknown;
  body?: unknown;
  headers?: unknown;
}

function validateEndpoint(endpoint: unknown): URL {
  if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
    throw new HttpError(400, "Endpoint must be a relative Flex API path", {
      code: "invalid_flex_endpoint",
    });
  }
  if (
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    endpoint.startsWith("//") ||
    endpoint.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(endpoint)
  ) {
    throw new HttpError(400, "Invalid Flex API endpoint", {
      code: "invalid_flex_endpoint",
    });
  }

  const baseUrl = new URL(FLEX_API_BASE_URL);
  const basePath = baseUrl.pathname.replace(/\/$/, "");
  const target = new URL(`${basePath}${endpoint}`, baseUrl.origin);

  if (
    target.origin !== baseUrl.origin ||
    !target.pathname.startsWith(`${basePath}/`)
  ) {
    throw new HttpError(400, "Flex API endpoint escaped the configured base path", {
      code: "invalid_flex_endpoint",
    });
  }

  const relativePath = target.pathname.slice(basePath.length);
  if (
    !ALLOWED_PATH_PREFIXES.some(
      (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
    )
  ) {
    throw new HttpError(400, "Flex API endpoint is not allowlisted", {
      code: "flex_endpoint_not_allowed",
    });
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

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );
  const flexAuthToken =
    Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN");

  if (!flexAuthToken) {
    console.error("secure-flex-api is missing required Flex auth token");
    throw new HttpError(503, "Service unavailable", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const caller = await requireAdminOrManagement(supabase, req, {
    logContext: "secure-flex-api",
    missingMessage: "Authentication required",
    invalidMessage: "Invalid authentication",
    forbiddenMessage: "Insufficient permissions",
  });

  const requestBody = await readBoundedJsonObject<FlexProxyRequest>(req, {
    maxBytes: MAX_BODY_LENGTH + 16 * 1024,
  });

  const method = String(requestBody.method || "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new HttpError(400, "Flex API method is not allowed", {
      code: "flex_method_not_allowed",
    });
  }

  const target = validateEndpoint(requestBody.endpoint);
  const body = requestBody.body;
  if (body !== undefined && typeof body !== "string") {
    throw new HttpError(400, "Flex API body must be a string", {
      code: "invalid_flex_body",
    });
  }
  if (typeof body === "string" && body.length > MAX_BODY_LENGTH) {
    throw new HttpError(413, "Flex API body is too large", {
      code: "flex_body_too_large",
    });
  }
  if (["GET", "DELETE"].includes(method) && body) {
    throw new HttpError(400, `${method} requests may not include a body`, {
      code: "invalid_flex_body",
    });
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
      user_id: caller.userId,
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
      : `Flex API returned ${response.status}`,
  });
}, {
  allowedMethods: ["POST"],
  onError(error) {
    console.error("secure-flex-api request failed", error);
  },
}));
