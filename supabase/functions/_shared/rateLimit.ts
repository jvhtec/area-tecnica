import { HttpError } from "./http.ts";

type RpcError = { message?: string } | null;

type EdgeRateLimitRpcRow = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
  retry_after_seconds: number;
};

type EdgeRateLimitRpcPayload = EdgeRateLimitRpcRow[] | EdgeRateLimitRpcRow | null;

export interface EdgeRateLimitClient {
  rpc(
    fn: "consume_edge_rate_limit",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: EdgeRateLimitRpcPayload; error: RpcError }>;
}

export interface EdgeRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
}

export interface BuildRateLimitIdentifierOptions {
  /** Secret salt. Prefer EDGE_RATE_LIMIT_HASH_SECRET; service-role key is an acceptable fallback. */
  salt?: string | null;
  includeIp?: boolean;
  includeUserAgent?: boolean;
}

export interface CheckEdgeRateLimitOptions extends BuildRateLimitIdentifierOptions {
  req: Request;
  supabase: EdgeRateLimitClient;
  scope: string;
  windowSeconds: number;
  maxRequests: number;
  identifierParts?: readonly unknown[];
}

const MAX_IDENTIFIER_PART_LENGTH = 512;

function firstHeaderValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function normalizeIdentifierPart(value: unknown): string {
  if (typeof value === "undefined" || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim().slice(0, MAX_IDENTIFIER_PART_LENGTH);
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value).slice(0, MAX_IDENTIFIER_PART_LENGTH);
  }

  try {
    const serialized = JSON.stringify(value);
    return (serialized ?? String(value)).slice(0, MAX_IDENTIFIER_PART_LENGTH);
  } catch {
    return String(value).slice(0, MAX_IDENTIFIER_PART_LENGTH);
  }
}

export function getClientIp(req: Request): string {
  return (
    firstHeaderValue(req.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(req.headers.get("x-real-ip")) ??
    firstHeaderValue(req.headers.get("x-forwarded-for")) ??
    "unknown"
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildRateLimitIdentifierHash(
  req: Request,
  identifierParts: readonly unknown[] = [],
  options: BuildRateLimitIdentifierOptions = {},
): Promise<string> {
  const includeIp = options.includeIp ?? true;
  const includeUserAgent = options.includeUserAgent ?? true;
  const parts = [
    options.salt ?? "",
    includeIp ? getClientIp(req) : "",
    includeUserAgent ? req.headers.get("user-agent") ?? "" : "",
    ...identifierParts,
  ].map(normalizeIdentifierPart);

  return sha256Hex(parts.join("\n"));
}

function normalizeRpcRow(
  data: EdgeRateLimitRpcPayload,
  limit: number,
  windowSeconds: number,
): EdgeRateLimitResult {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("rate limit RPC returned no row");
  }

  return {
    allowed: row.allowed,
    remaining: Math.max(0, Number(row.remaining) || 0),
    resetAt: typeof row.reset_at === "string" ? row.reset_at : "",
    retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds) || 0),
    limit,
    windowSeconds,
  };
}

export async function consumeEdgeRateLimit(args: {
  supabase: EdgeRateLimitClient;
  scope: string;
  identifierHash: string;
  windowSeconds: number;
  maxRequests: number;
}): Promise<EdgeRateLimitResult> {
  const { supabase, scope, identifierHash, windowSeconds, maxRequests } = args;
  const { data, error } = await supabase.rpc("consume_edge_rate_limit", {
    p_scope: scope,
    p_identifier_hash: identifierHash,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests,
  });

  if (error) {
    throw new Error(error.message || "rate limit RPC failed");
  }

  return normalizeRpcRow(data, maxRequests, windowSeconds);
}

export async function checkEdgeRateLimit(options: CheckEdgeRateLimitOptions): Promise<EdgeRateLimitResult> {
  const identifierHash = await buildRateLimitIdentifierHash(
    options.req,
    options.identifierParts ?? [],
    {
      salt: options.salt,
      includeIp: options.includeIp,
      includeUserAgent: options.includeUserAgent,
    },
  );

  return consumeEdgeRateLimit({
    supabase: options.supabase,
    scope: options.scope,
    identifierHash,
    windowSeconds: options.windowSeconds,
    maxRequests: options.maxRequests,
  });
}

export function rateLimitHeaders(result: EdgeRateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };

  const resetEpochSeconds = Math.ceil(Date.parse(result.resetAt) / 1000);
  if (Number.isFinite(resetEpochSeconds)) {
    headers["X-RateLimit-Reset"] = String(resetEpochSeconds);
  }

  if (!result.allowed) {
    headers["Retry-After"] = String(Math.max(1, result.retryAfterSeconds));
  }

  return headers;
}

export function rateLimitExceededError(result: EdgeRateLimitResult): HttpError {
  return new HttpError(429, "Too many requests", {
    code: "rate_limited",
    details: {
      retry_after_seconds: Math.max(1, result.retryAfterSeconds),
    },
  });
}
