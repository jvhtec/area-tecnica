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

interface FetchFlexInventoryModelBody extends Record<string, unknown> {
  model_id?: unknown;
  url?: unknown;
}

// Expected structure from Flex API inventory-model endpoint
interface FlexInventoryModelResponse {
  preferredDisplayString?: string;
  name?: string;
  manufacturer?: string;
  notes?: string;
  size?: string;
  shortName?: string;
  code?: string;
  imageThumbnailId?: string;
  imageId?: string;
  // Allow additional unknown fields from Flex API
  [key: string]: unknown;
}

// Validated and sanitized response we return
interface ValidatedEquipmentData {
  name: string;
  manufacturer: string;
  notes: string;
  size: string;
  shortName: string;
  code: string;
  imageId: string;
}

function extractUuid(input: string): string | null {
  const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
  const m = (input || '').match(uuidRe);
  return m?.[0] || null;
}

// Sanitize string to prevent XSS - only allow safe characters
function sanitizeString(value: unknown, maxLength = 500): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return '';
  // Remove any HTML tags and trim to max length
  return value
    .replace(/<[^>]*>/g, '')  // Remove HTML tags
    .replace(/[<>'"&]/g, '')  // Remove potentially dangerous chars
    .substring(0, maxLength)
    .trim();
}

// Validate and sanitize Flex API response
function validateFlexResponse(data: unknown): ValidatedEquipmentData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Flex API response: expected object');
  }

  const info = data as FlexInventoryModelResponse;

  return {
    name: sanitizeString(info.preferredDisplayString || info.name, 255),
    manufacturer: sanitizeString(info.manufacturer, 255),
    notes: sanitizeString(info.notes, 1000),
    size: sanitizeString(info.size, 100),
    shortName: sanitizeString(info.shortName, 100),
    code: sanitizeString(info.code, 50),
    imageId: sanitizeString(info.imageThumbnailId || info.imageId, 100),
  };
}

serve(createHttpHandler(async (req: Request) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));
  const flexAuthToken =
    Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";

  if (!flexAuthToken) {
    throw new HttpError(503, "Flex auth not configured", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  await requireAdminOrManagement(supabase, req, {
    logContext: "fetch-flex-inventory-model",
  });

  const body = await readBoundedJsonObject<FetchFlexInventoryModelBody>(req, { maxBytes: 16 * 1024 });

  // Parse model id
  const modelInput = typeof body.model_id === "string" ? body.model_id : "";
  const urlInput = typeof body.url === "string" ? body.url : "";
  const modelId = extractUuid(modelInput) || extractUuid(urlInput);
  if (!modelId) {
    throw new HttpError(400, "Missing model_id or url", {
      code: "missing_flex_model_id",
    });
  }

  // Call Flex inventory-model API
  const qs = new URLSearchParams();
  qs.set('_dc', String(Date.now()));
  const url = `https://sectorpro.flexrentalsolutions.com/f5/api/inventory-model/${encodeURIComponent(modelId)}?${qs.toString()}`;
  const res = await fetchWithRetry(url, { headers: { 'X-Auth-Token': flexAuthToken, 'apikey': flexAuthToken, 'X-Requested-With': 'XMLHttpRequest' } });
  if (!res.ok) {
    throw new HttpError(502, `Flex error ${res.status}`, {
      code: "flex_upstream_error",
    });
  }
  const rawResponse = await res.json();

  // Validate and sanitize the Flex API response
  let mapped: ValidatedEquipmentData;
  try {
    mapped = validateFlexResponse(rawResponse);
  } catch (validationError) {
    throw new HttpError(502, "Invalid response from Flex API", {
      code: "invalid_flex_response",
      details: validationError instanceof Error ? validationError.message : undefined,
    });
  }

  return jsonResponse({
    ok: true,
    model_id: modelId,
    mapped,
  });
}, {
  allowedMethods: ["POST"],
}));
