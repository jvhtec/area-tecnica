import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  requireEnvValues,
} from "../_shared/http.ts";
import { requireAdminOrManagement } from "../_shared/auth.ts";
import { persistSecurityAuditLog } from "../_shared/securityAudit.ts";

// Privileged integrity diagnostics (ENT-OBS-02).
//
// Previously this function used the service role with no caller check and
// returned sample rows plus raw database error messages to anyone who could
// reach it. It is now:
//   * gated on an authenticated admin/management caller,
//   * stripped of business-data samples,
//   * stripped of internal error message leakage (logged server-side only),
//   * audited on every access.
//
// Unauthenticated liveness lives in the separate `health` function.

type CheckStatus = "ok" | "warning" | "critical" | "error";

interface CheckResult {
  status: CheckStatus;
  count: number;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

function summarizeCheck(
  result: RpcResult,
  nonEmptyStatus: Exclude<CheckStatus, "ok" | "error">,
): CheckResult {
  if (result.error) {
    // Surface only that the probe failed; never the raw DB error text.
    return { status: "error", count: 0 };
  }

  const count = Array.isArray(result.data) ? result.data.length : 0;
  return { status: count === 0 ? "ok" : nonEmptyStatus, count };
}

serve(createHttpHandler(async (req) => {
  const {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  } = requireEnvValues(
    ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
    (name) => Deno.env.get(name),
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await requireAdminOrManagement(supabase, req, {
    logContext: "system-health",
    missingMessage: "Unauthorized",
    invalidMessage: "Unauthorized",
    invalidCode: "invalid_token",
    forbiddenMessage: "Forbidden",
    onForbidden: ({ userId, role }) =>
      persistSecurityAuditLog(req, supabase, {
        user_id: userId,
        action: "system_health_access_denied",
        resource: "edge.system-health",
        severity: "medium",
        metadata: { role: role || null },
      }).catch((error) => console.error("system-health audit (denied) failed", error)),
  });

  const [orphanedResult, doubleBookingResult, declinedResult] = await Promise.all([
    supabase.rpc("find_orphaned_timesheets"),
    supabase.rpc("find_double_bookings"),
    supabase.rpc("find_declined_with_active_timesheets"),
  ]) as RpcResult[];

  const checks = {
    orphaned_timesheets: summarizeCheck(orphanedResult, "warning"),
    double_bookings: summarizeCheck(doubleBookingResult, "critical"),
    declined_with_active_timesheets: summarizeCheck(declinedResult, "warning"),
  };

  // Log the raw probe errors server-side for operators without returning them.
  for (const [name, result] of Object.entries({
    orphaned_timesheets: orphanedResult,
    double_bookings: doubleBookingResult,
    declined_with_active_timesheets: declinedResult,
  })) {
    if (result.error) {
      console.error(`system-health check failed: ${name}`, result.error?.message);
    }
  }

  const statuses = Object.values(checks).map((check) => check.status);
  const overallStatus: CheckStatus = statuses.includes("error")
    ? "error"
    : statuses.includes("critical")
      ? "critical"
      : statuses.includes("warning")
        ? "warning"
        : "ok";

  await persistSecurityAuditLog(req, supabase, {
    user_id: caller.userId,
    action: "system_health_viewed",
    resource: "edge.system-health",
    severity: "low",
    metadata: { overall_status: overallStatus },
  }).catch((error) => console.error("system-health audit failed", error));

  // The probe itself succeeded; integrity status is carried in the body so
  // monitors do not treat a data warning as an endpoint outage.
  return jsonResponse({
    healthy: overallStatus === "ok",
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
}, {
  allowedMethods: ["GET", "POST"],
  internalErrorMessage: "Health check failed",
  onError: (error) => {
    if (!(error instanceof HttpError)) {
      console.error("system-health unhandled error", error);
    }
  },
}));
