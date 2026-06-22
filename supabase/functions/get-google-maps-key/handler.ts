import { jsonResponse } from "../_shared/cors.ts";
import {
  extractBearerToken,
  persistSecurityAuditLog,
} from "../_shared/securityAudit.ts";

interface GetGoogleMapsKeyDeps {
  supabase: {
    auth: {
      getUser: (
        accessToken: string,
      ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    };
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  // Retained for signature compatibility with index.ts; no longer used.
  getEnv?: (name: string) => string | undefined;
  allowedRoles?: string[] | null;
}

async function auditGoogleMapsKeyAccess(
  req: Request,
  deps: GetGoogleMapsKeyDeps,
  details: {
    userId?: string | null;
    outcome: string;
  },
): Promise<void> {
  try {
    await persistSecurityAuditLog(req, deps.supabase, {
      user_id: details.userId ?? null,
      action: "google_maps_key_access",
      resource: "google_maps_api_key",
      severity: "low",
      metadata: {
        success: false,
        outcome: details.outcome,
      },
    });
  } catch (error) {
    console.error("Failed to audit Google Maps key access:", error);
  }
}

/**
 * Deprecated endpoint.
 *
 * The Google Maps API key is no longer exposed to clients. Maps, geocoding and
 * autocomplete now use Mapbox (public token via `get-mapbox-token`), and the
 * remaining Google Places features (restaurants, photos) call Google only from
 * server-side edge functions where the key stays in `GOOGLE_MAPS_API_KEY`.
 *
 * This handler always returns 410 Gone and never returns the key, while still
 * recording any access attempt for auditing.
 */
export async function handleGetGoogleMapsKeyRequest(
  req: Request,
  deps: GetGoogleMapsKeyDeps,
): Promise<Response> {
  const accessToken = extractBearerToken(req);

  let userId: string | null = null;
  if (accessToken) {
    try {
      const { data } = await deps.supabase.auth.getUser(accessToken);
      userId = data?.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  await auditGoogleMapsKeyAccess(req, deps, {
    userId,
    outcome: "deprecated_endpoint",
  });

  return jsonResponse(
    {
      error:
        "This endpoint has been deprecated. Maps now use Mapbox via get-mapbox-token; Google Places features run server-side only.",
    },
    { status: 410 },
  );
}
