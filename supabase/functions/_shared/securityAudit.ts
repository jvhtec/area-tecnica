import { jsonResponse } from "./cors.ts";

export type SecurityAuditSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityAuditEventInput {
  user_id?: string | null;
  action: string;
  resource: string;
  severity: SecurityAuditSeverity;
  metadata?: Record<string, unknown>;
}

interface AuditAuthUser {
  id: string;
  email?: string | null;
}

interface AuditInsertClient {
  auth: {
    getUser: (
      accessToken: string,
    ) => Promise<{ data: { user: AuditAuthUser | null }; error: unknown }>;
  };
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
}

const ALLOWED_SEVERITIES: SecurityAuditSeverity[] = ["low", "medium", "high", "critical"];
const REDACTED_FIELDS = new Set([
  "authorization",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "secret_value",
  "secretvalue",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value: unknown, key?: string): unknown {
  const normalizedKey = key?.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (normalizedKey && REDACTED_FIELDS.has(normalizedKey)) {
    return "[REDACTED]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "function" || typeof value === "symbol" || typeof value === "undefined") {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (isRecord(value)) {
    const sanitizedEntries = Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childValue, childKey),
    ]);

    return Object.fromEntries(sanitizedEntries);
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

export function sanitizeSecurityAuditMetadata(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return sanitizeValue(value) as Record<string, unknown>;
}

export function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function resolveAuthenticatedAuditUser(
  req: Request,
  client: AuditInsertClient,
): Promise<AuditAuthUser | null> {
  const accessToken = extractBearerToken(req);

  if (!accessToken) {
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export function getRequestIpAddress(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const directIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-client-ip");

  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    return firstIp?.trim() || null;
  }

  return directIp?.trim() || null;
}

export function getRequestUserAgent(req: Request): string | null {
  return req.headers.get("user-agent")?.trim() || null;
}

export async function persistSecurityAuditLog(
  req: Request,
  client: AuditInsertClient,
  event: SecurityAuditEventInput,
): Promise<void> {
  const payload = {
    user_id: event.user_id ?? null,
    action: event.action.trim(),
    resource: event.resource.trim(),
    severity: event.severity,
    ip_address: getRequestIpAddress(req),
    user_agent: getRequestUserAgent(req),
    metadata: sanitizeSecurityAuditMetadata(event.metadata),
  };

  const { error } = await client.from("security_audit_log").insert(payload);

  if (error) {
    throw new Error(`Failed to persist security audit log: ${String(error)}`);
  }
}

export function validateSecurityAuditEvent(
  input: unknown,
): { event: SecurityAuditEventInput | null; errorResponse: Response | null } {
  if (!isRecord(input)) {
    return {
      event: null,
      errorResponse: jsonResponse({ error: "Invalid audit payload" }, { status: 400 }),
    };
  }

  const action = typeof input.action === "string" ? input.action.trim() : "";
  const resource = typeof input.resource === "string" ? input.resource.trim() : "";
  const severity = input.severity;
  const userId =
    typeof input.user_id === "string"
      ? input.user_id.trim() || null
      : input.user_id === null || typeof input.user_id === "undefined"
        ? null
        : "__invalid__";

  if (!action || action.length > 120 || !resource || resource.length > 255) {
    return {
      event: null,
      errorResponse: jsonResponse({ error: "Invalid audit payload" }, { status: 400 }),
    };
  }

  if (!ALLOWED_SEVERITIES.includes(severity as SecurityAuditSeverity) || userId === "__invalid__") {
    return {
      event: null,
      errorResponse: jsonResponse({ error: "Invalid audit payload" }, { status: 400 }),
    };
  }

  if (typeof input.metadata !== "undefined" && !isRecord(input.metadata)) {
    return {
      event: null,
      errorResponse: jsonResponse({ error: "Invalid audit payload" }, { status: 400 }),
    };
  }

  return {
    event: {
      user_id: userId,
      action,
      resource,
      severity,
      metadata: input.metadata,
    },
    errorResponse: null,
  };
}
