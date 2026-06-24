import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchWithRetry } from "../_shared/flexFetch.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireBearerToken,
  requireEnvValues,
} from "../_shared/http.ts";

// Valid image ID pattern (UUID or Flex-specific ID)
const IMAGE_ID_PATTERN = /^[a-zA-Z0-9-]{1,100}$/;

interface FetchFlexImageBody extends Record<string, unknown> {
  imageId?: unknown;
  size?: unknown;
}

serve(createHttpHandler(async (req: Request) => {
  let imageId: string | null = null;
  let size: "thumb" | "full" = "thumb";

  // Support both GET (query params) and POST (JSON body)
  if (req.method === "GET") {
    const url = new URL(req.url);
    imageId = url.searchParams.get("imageId");
    const sizeParam = url.searchParams.get("size");
    if (sizeParam === "full") size = "full";
  } else {
    const body = await readBoundedJsonObject<FetchFlexImageBody>(req, { maxBytes: 4 * 1024 });
    imageId = typeof body.imageId === "string" ? body.imageId : null;
    if (body.size === "full") size = "full";
  }

  // Validate imageId
  if (!imageId) {
    throw new HttpError(400, "imageId is required", {
      code: "missing_image_id",
    });
  }

  if (!IMAGE_ID_PATTERN.test(imageId)) {
    throw new HttpError(400, "Invalid imageId format", {
      code: "invalid_image_id",
    });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => Deno.env.get(name));

  // AuthZ: Require authenticated user (any role can view equipment images)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = requireBearerToken(req);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new HttpError(401, "Unauthorized", {
      code: "invalid_authorization",
    });
  }

  const flexAuthToken =
    Deno.env.get("X_AUTH_TOKEN") || Deno.env.get("FLEX_X_AUTH_TOKEN") || "";

  if (!flexAuthToken) {
    throw new HttpError(503, "Flex auth not configured", {
      code: "flex_auth_missing",
      exposeDetails: false,
    });
  }

  // Fetch image from Flex API
  const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/api/image/${encodeURIComponent(imageId)}/${size}`;

  const flexResponse = await fetchWithRetry(flexUrl, {
    headers: {
      "X-Auth-Token": flexAuthToken,
      "apikey": flexAuthToken,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!flexResponse.ok) {
    // Return 404 directly for missing images (graceful degradation)
    if (flexResponse.status === 404) {
      return new Response(null, { status: 404 });
    }
    return jsonResponse({
      error: `Flex API error: ${flexResponse.status}`
    }, { status: 502 });
  }

  // Get the image content
  const imageBlob = await flexResponse.blob();
  const contentType = flexResponse.headers.get("Content-Type") || "image/jpeg";

  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new HttpError(502, "Flex image response had an invalid content type", {
      code: "invalid_flex_image_response",
    });
  }

  // Return the image with authenticated-user-safe caching headers
  return new Response(imageBlob, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600", // Cache for 1 hour in the user's browser only
    },
  });
}, { allowedMethods: ["GET", "POST"] }));
