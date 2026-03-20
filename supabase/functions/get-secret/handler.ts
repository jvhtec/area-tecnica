import { jsonResponse } from "../_shared/cors.ts";
import {
  extractBearerToken,
  persistSecurityAuditLog,
} from "../_shared/securityAudit.ts";

const ALLOWED_SECRET_NAMES = ["X_AUTH_TOKEN", "OPENAI_API_KEY", "GOOGLE_MAPS_API_KEY"];
const MANAGEMENT_ROLES = new Set(["admin", "management"]);

interface ProfileRecord {
  role: string | null;
}

interface GetSecretDeps {
  supabase: {
    auth: {
      getUser: (
        accessToken: string,
      ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
    };
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          single: () => Promise<{ data: ProfileRecord | null; error: unknown }>;
        };
      };
      insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  getEnv: (name: string) => string | undefined;
}

async function auditSecretAccess(
  req: Request,
  deps: GetSecretDeps,
  details: {
    userId?: string | null;
    secretName?: string | null;
    success: boolean;
    outcome: string;
    role?: string | null;
  },
): Promise<void> {
  try {
    await persistSecurityAuditLog(req, deps.supabase, {
      user_id: details.userId ?? null,
      action: "secret_access",
      resource: `secret:${details.secretName ?? "unknown"}`,
      severity: details.success ? "low" : "high",
      metadata: {
        success: details.success,
        outcome: details.outcome,
        role: details.role ?? null,
        secret_name: details.secretName ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to audit get-secret access:", error);
  }
}

export async function handleGetSecretRequest(
  req: Request,
  deps: GetSecretDeps,
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const secretName = typeof body?.secretName === "string" ? body.secretName.trim() : "";

  if (!secretName) {
    await auditSecretAccess(req, deps, {
      secretName: null,
      success: false,
      outcome: "invalid_request",
    });
    return jsonResponse({ error: "secretName is required" }, { status: 400 });
  }

  const accessToken = extractBearerToken(req);

  if (!accessToken) {
    await auditSecretAccess(req, deps, {
      secretName,
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
    await auditSecretAccess(req, deps, {
      secretName,
      success: false,
      outcome: "invalid_authentication",
    });
    return jsonResponse({ error: "Invalid authentication" }, { status: 401 });
  }

  const profileQuery = deps.supabase.from("profiles").select("role");
  const { data: profile, error: profileError } = await profileQuery.eq("id", user.id).single();

  if (profileError || !profile) {
    await auditSecretAccess(req, deps, {
      userId: user.id,
      secretName,
      success: false,
      outcome: "profile_not_found",
    });
    return jsonResponse({ error: "User profile not found" }, { status: 403 });
  }

  if (!MANAGEMENT_ROLES.has(profile.role ?? "")) {
    await auditSecretAccess(req, deps, {
      userId: user.id,
      secretName,
      success: false,
      outcome: "insufficient_permissions",
      role: profile.role,
    });
    return jsonResponse({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (!ALLOWED_SECRET_NAMES.includes(secretName)) {
    await auditSecretAccess(req, deps, {
      userId: user.id,
      secretName,
      success: false,
      outcome: "secret_not_allowed",
      role: profile.role,
    });
    return jsonResponse({ error: `Secret ${secretName} not allowed` }, { status: 403 });
  }

  const secretValue = deps.getEnv(secretName);

  if (!secretValue) {
    await auditSecretAccess(req, deps, {
      userId: user.id,
      secretName,
      success: false,
      outcome: "secret_not_configured",
      role: profile.role,
    });
    return jsonResponse({ error: `Secret ${secretName} not found` }, { status: 404 });
  }

  await auditSecretAccess(req, deps, {
    userId: user.id,
    secretName,
    success: true,
    outcome: "allowed",
    role: profile.role,
  });

  return jsonResponse({ [secretName]: secretValue }, { status: 200 });
}
