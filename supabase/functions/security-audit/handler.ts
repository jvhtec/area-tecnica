import { jsonResponse } from "../_shared/cors.ts";
import {
  persistSecurityAuditLog,
  resolveAuthenticatedAuditUser,
  validateSecurityAuditEvent,
} from "../_shared/securityAudit.ts";

interface SecurityAuditHandlerDeps {
  supabase: {
    auth: {
      getUser: (
        accessToken: string,
      ) => Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
    };
    from: (table: string) => {
      insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
}

export async function handleSecurityAuditRequest(
  req: Request,
  deps: SecurityAuditHandlerDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await req.json().catch(() => null);
  const { event, errorResponse } = validateSecurityAuditEvent(body);

  if (!event || errorResponse) {
    return errorResponse ?? jsonResponse({ error: "Invalid audit payload" }, { status: 400 });
  }

  const authenticatedUser = await resolveAuthenticatedAuditUser(req, deps.supabase);
  const resolvedUserId = authenticatedUser?.id ?? event.user_id ?? null;

  await persistSecurityAuditLog(req, deps.supabase, {
    ...event,
    user_id: resolvedUserId,
  });

  return jsonResponse({ success: true }, { status: 201 });
}
