import { jsonResponse } from "../_shared/cors.ts";
import {
  extractBearerToken,
  persistSecurityAuditLog,
} from "../_shared/securityAudit.ts";

const SECRET_RESOURCE_PREFIX = "secret:";
const MAX_AUDIT_RESOURCE_LENGTH = 255;
const MAX_AUDIT_SECRET_NAME_LENGTH =
  MAX_AUDIT_RESOURCE_LENGTH - SECRET_RESOURCE_PREFIX.length;

interface GetSecretDeps {
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
}

async function auditBlockedSecretAccess(
  req: Request,
  deps: GetSecretDeps,
  details: {
    userId?: string | null;
    secretName?: string | null;
    outcome: string;
  },
): Promise<void> {
  const normalizedSecretName = (details.secretName ?? "unknown").slice(
    0,
    MAX_AUDIT_SECRET_NAME_LENGTH,
  );

  await persistSecurityAuditLog(req, deps.supabase, {
    user_id: details.userId ?? null,
    action: "secret_access_blocked",
    resource: `${SECRET_RESOURCE_PREFIX}${normalizedSecretName}`,
    severity: "high",
    metadata: {
      success: false,
      outcome: details.outcome,
      secret_name: details.secretName ?? null,
      secret_name_truncated:
        normalizedSecretName !== (details.secretName ?? "unknown"),
    },
  });
}

export async function handleGetSecretRequest(
  req: Request,
  deps: GetSecretDeps,
): Promise<Response> {
  const body = await req.json().catch(() => null);
  const secretName =
    typeof body?.secretName === "string" ? body.secretName.trim() : "";

  if (!secretName) {
    await auditBlockedSecretAccess(req, deps, {
      secretName: null,
      outcome: "invalid_request",
    });
    return jsonResponse({ error: "secretName is required" }, { status: 400 });
  }

  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    await auditBlockedSecretAccess(req, deps, {
      secretName,
      outcome: "missing_authorization",
    });
    return jsonResponse({ error: "Authorization header required" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await deps.supabase.auth.getUser(accessToken);

  if (authError || !user) {
    await auditBlockedSecretAccess(req, deps, {
      secretName,
      outcome: "invalid_authentication",
    });
    return jsonResponse({ error: "Invalid authentication" }, { status: 401 });
  }

  await auditBlockedSecretAccess(req, deps, {
    userId: user.id,
    secretName,
    outcome: "direct_secret_delivery_disabled",
  });

  return jsonResponse(
    {
      error:
        "Direct secret delivery is disabled. Use an approved server-side operation.",
    },
    { status: 410 },
  );
}
