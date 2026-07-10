import { HttpError, jsonResponse, readBoundedJsonObject } from "../_shared/http.ts";
import { checkEdgeRateLimit, rateLimitHeaders } from "../_shared/rateLimit.ts";
import {
  persistAnonymousSecurityAuditLog,
  persistSecurityAuditLog,
  resolveAuthenticatedAuditUser,
  validateSecurityAuditEvent,
} from "../_shared/securityAudit.ts";

interface SecurityAuditHandlerDeps {
  rateLimitSalt: string;
  supabase: {
    auth: {
      getUser: (
        accessToken: string,
      ) => Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
    };
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
    rpc: (
      fn: "consume_edge_rate_limit",
      args: Record<string, unknown>,
    ) => PromiseLike<{
      data: { allowed: boolean; remaining: number; reset_at: string; retry_after_seconds: number } | null;
      error: { message?: string } | null;
    }>;
  };
}

const MAX_AUDIT_BODY_BYTES = 16 * 1024;
const ANONYMOUS_ACTIONS = new Set(["auth_login", "password_reset_request"]);

export async function handleSecurityAuditRequest(
  req: Request,
  deps: SecurityAuditHandlerDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonObject(req, { maxBytes: MAX_AUDIT_BODY_BYTES });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
  const { event, errorResponse } = validateSecurityAuditEvent(body);

  if (!event || errorResponse) {
    return errorResponse ?? jsonResponse({ error: "Invalid audit payload" }, { status: 400 });
  }

  const authenticatedUser = await resolveAuthenticatedAuditUser(req, deps.supabase);
  const isAnonymousEvent = !authenticatedUser;
  if (
    isAnonymousEvent &&
    (event.resource !== "authentication" || !ANONYMOUS_ACTIONS.has(event.action))
  ) {
    return jsonResponse({ error: "Authenticated user required" }, { status: 401 });
  }

  const rateLimit = await checkEdgeRateLimit({
    req,
    supabase: deps.supabase,
    scope: isAnonymousEvent ? "security-audit-anonymous" : "security-audit-authenticated",
    windowSeconds: isAnonymousEvent ? 10 * 60 : 60,
    maxRequests: isAnonymousEvent ? 20 : 120,
    identifierParts: authenticatedUser ? [authenticatedUser.id] : [event.action],
    salt: deps.rateLimitSalt,
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }

  if (authenticatedUser) {
    await persistSecurityAuditLog(req, deps.supabase, {
      ...event,
      user_id: authenticatedUser.id,
    });
  } else {
    await persistAnonymousSecurityAuditLog(req, deps.supabase, event);
  }

  return jsonResponse(
    { success: true },
    { status: 201, headers: rateLimitHeaders(rateLimit) },
  );
}
