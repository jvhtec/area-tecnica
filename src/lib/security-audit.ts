import { supabase } from "@/lib/supabase";

export interface SecurityAuditLog {
  user_id?: string | null;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Logs security-related events for audit purposes
 */
function sanitizeAuditMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  try {
    return JSON.parse(
      JSON.stringify(value, (_key, item) => {
        if (item instanceof Date) return item.toISOString();
        if (item instanceof Error) {
          return {
            name: item.name,
            message: item.message,
          };
        }
        if (typeof item === "bigint") return item.toString();
        if (typeof item === "function" || typeof item === "symbol" || typeof item === "undefined") {
          return null;
        }
        return item;
      }),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface LogSecurityEventOptions {
  accessToken?: string;
}

export async function logSecurityEvent(
  event: SecurityAuditLog,
  options?: LogSecurityEventOptions,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("security-audit", {
      body: {
        user_id: event.user_id ?? null,
        action: event.action,
        resource: event.resource,
        severity: event.severity,
        metadata: sanitizeAuditMetadata(event.metadata),
      },
      ...(options?.accessToken
        ? {
            headers: {
              Authorization: `Bearer ${options.accessToken}`,
            },
          }
        : {}),
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Failed to log security event:", error);
    // Don't throw error to avoid breaking the main application flow
  }
}

/**
 * Logs API key usage attempts
 */
export async function logApiKeyUsage(
  userId: string | null | undefined,
  endpoint: string,
  success: boolean,
): Promise<void> {
  await logSecurityEvent({
    user_id: userId ?? null,
    action: "api_key_usage",
    resource: `flex_api${endpoint}`,
    metadata: { success, endpoint },
    severity: success ? "low" : "medium",
  });
}

/**
 * Logs authentication events
 */
export async function logAuthEvent(
  userId: string | null | undefined,
  action: string,
  success: boolean,
  metadata?: Record<string, unknown>,
  options?: LogSecurityEventOptions,
): Promise<void> {
  await logSecurityEvent(
    {
      user_id: userId ?? null,
      action: `auth_${action}`,
      resource: "authentication",
      metadata: { success, ...(metadata ?? {}) },
      severity: success ? "low" : "high",
    },
    options,
  );
}

/**
 * Logs suspicious activity
 */
export async function logSuspiciousActivity(
  userId: string | null | undefined,
  activity: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await logSecurityEvent({
    user_id: userId ?? null,
    action: "suspicious_activity",
    resource: "system",
    metadata: {
      activity,
      ...(metadata ?? {}),
    },
    severity: "critical",
  });
}
