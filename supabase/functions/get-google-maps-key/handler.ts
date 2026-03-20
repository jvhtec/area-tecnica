import { jsonResponse } from "../_shared/cors.ts";
import {
  extractBearerToken,
  persistSecurityAuditLog,
} from "../_shared/securityAudit.ts";

const MANAGEMENT_ROLES = new Set(["admin", "management"]);

interface ProfileRecord {
  role: string | null;
}

interface GetGoogleMapsKeyDeps {
  supabase: {
    auth: {
      getUser: (
        accessToken: string,
      ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    };
    from: (table: string) => {
      select?: (columns: string) => {
        eq: (column: string, value: string) => {
          single: () => Promise<{ data: ProfileRecord | null; error: unknown }>;
        };
      };
      insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  getEnv: (name: string) => string | undefined;
  allowedRoles: string[] | null;
}

async function auditGoogleMapsKeyAccess(
  req: Request,
  deps: GetGoogleMapsKeyDeps,
  details: {
    userId?: string | null;
    success: boolean;
    outcome: string;
    role?: string | null;
  },
): Promise<void> {
  try {
    await persistSecurityAuditLog(req, deps.supabase, {
      user_id: details.userId ?? null,
      action: "google_maps_key_access",
      resource: "google_maps_api_key",
      severity: details.success ? "low" : "high",
      metadata: {
        success: details.success,
        outcome: details.outcome,
        role: details.role ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to audit Google Maps key access:", error);
  }
}

export async function handleGetGoogleMapsKeyRequest(
  req: Request,
  deps: GetGoogleMapsKeyDeps,
): Promise<Response> {
  const accessToken = extractBearerToken(req);

  if (!accessToken) {
    await auditGoogleMapsKeyAccess(req, deps, {
      success: false,
      outcome: "missing_authorization",
    });
    return jsonResponse({ error: "Authorization header required" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await deps.supabase.auth.getUser(accessToken);

  if (authError || !user) {
    await auditGoogleMapsKeyAccess(req, deps, {
      success: false,
      outcome: "invalid_authentication",
    });
    return jsonResponse({ error: "Invalid authentication" }, { status: 401 });
  }

  const profileQuery = deps.supabase.from("profiles").select?.("role");
  const { data: profile, error: profileError } = await profileQuery?.eq("id", user.id).single() ?? {
    data: null,
    error: new Error("Profile query unavailable"),
  };

  if (profileError || !profile) {
    await auditGoogleMapsKeyAccess(req, deps, {
      userId: user.id,
      success: false,
      outcome: "profile_not_found",
    });
    return jsonResponse({ error: "User profile not found" }, { status: 403 });
  }

  const role = profile.role ?? "";

  if (!MANAGEMENT_ROLES.has(role) || (deps.allowedRoles && !deps.allowedRoles.includes(role))) {
    await auditGoogleMapsKeyAccess(req, deps, {
      userId: user.id,
      success: false,
      outcome: "insufficient_permissions",
      role,
    });
    return jsonResponse({ error: "Insufficient permissions" }, { status: 403 });
  }

  const googleMapsKey = deps.getEnv("GOOGLE_MAPS_API_KEY");

  if (!googleMapsKey) {
    await auditGoogleMapsKeyAccess(req, deps, {
      userId: user.id,
      success: false,
      outcome: "key_not_configured",
      role: profile.role,
    });
    return jsonResponse({ error: "Google Maps API key not configured" }, { status: 500 });
  }

  await auditGoogleMapsKeyAccess(req, deps, {
    userId: user.id,
    success: true,
    outcome: "allowed",
    role,
  });

  return jsonResponse(
    { apiKey: googleMapsKey },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private, max-age=0",
      },
    },
  );
}
