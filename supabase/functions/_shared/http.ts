import { corsHeaders, jsonResponse as corsJsonResponse } from "./cors.ts";

export { corsHeaders };

type JsonBody = Record<string, unknown>;

/** Structured error type for HTTP responses produced by Edge Function handlers. */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly exposeDetails: boolean;

  constructor(
    status: number,
    message: string,
    options: {
      code?: string;
      details?: unknown;
      exposeDetails?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options.code;
    this.details = options.details;
    this.exposeDetails = options.exposeDetails ?? status < 500;
  }
}

/** Creates a JSON response with the repository's default Edge Function CORS headers. */
export function jsonResponse(body: unknown, init?: ResponseInit | number) {
  return corsJsonResponse(
    body,
    typeof init === "number" ? { status: init } : init,
  );
}

/** Creates a CORS preflight response. */
export function preflightResponse(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

/** Returns a response with any missing default CORS headers added. */
export function withCorsHeaders(response: Response) {
  const headers = new Headers(response.headers);

  for (const [header, value] of Object.entries(corsHeaders)) {
    if (!headers.has(header)) {
      headers.set(header, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Creates a standard method-not-allowed JSON response with an Allow header. */
export function methodNotAllowedResponse(
  allowedMethods: readonly string[],
  options: { status?: number; body?: unknown } = {},
) {
  return jsonResponse(
    options.body ?? { error: "Method not allowed" },
    {
      status: options.status ?? 405,
      headers: {
        Allow: allowedMethods.join(", "),
      },
    },
  );
}

/** Extracts a Bearer token from the request Authorization header. */
export function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/** Extracts a Bearer token or throws an HTTP 401 error. */
export function requireBearerToken(
  req: Request,
  options: { message?: string; code?: string } = {},
) {
  const token = extractBearerToken(req);

  if (!token) {
    throw new HttpError(401, options.message ?? "Unauthorized", {
      code: options.code ?? "missing_authorization",
    });
  }

  return token;
}

/** Reads and parses the request body as JSON, converting parse failures to HTTP 400. */
export async function readJsonBody<T = unknown>(
  req: Request,
  options: { message?: string; code?: string } = {},
): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new HttpError(400, options.message ?? "Invalid JSON body", {
      code: options.code ?? "invalid_json",
    });
  }
}

function isRecord(value: unknown): value is JsonBody {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Default maximum accepted request body size (1 MiB). */
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

const CORRELATION_HEADER = "x-correlation-id";
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Returns a stable correlation id for a request: the inbound `x-correlation-id`
 * header when present and well-formed, otherwise a freshly generated UUID. Use
 * it to tie browser → Edge → database → provider log lines together.
 */
export function getCorrelationId(req: Request): string {
  const inbound = req.headers.get(CORRELATION_HEADER)?.trim();

  if (inbound && CORRELATION_ID_PATTERN.test(inbound)) {
    return inbound;
  }

  return crypto.randomUUID();
}

/** Returns response headers carrying the correlation id. */
export function correlationHeaders(correlationId: string): Record<string, string> {
  return { [CORRELATION_HEADER]: correlationId };
}

/**
 * Reads the request body as text while enforcing a maximum size. The
 * `Content-Length` header is checked first (fast reject), then the body is
 * streamed and the running byte total is enforced incrementally so an untrusted
 * payload is never fully buffered beyond `maxBytes` (defends against chunked or
 * misreported requests). Oversized bodies throw HTTP 413.
 */
export async function readBoundedText(
  req: Request,
  options: { maxBytes?: number; message?: string; code?: string } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const message = options.message ?? "Request body too large";
  const code = options.code ?? "payload_too_large";

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new HttpError(413, message, { code });
    }
  }

  if (!req.body) {
    return "";
  }

  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, message, { code });
    }

    raw += decoder.decode(value, { stream: true });
  }

  raw += decoder.decode();
  return raw;
}

/** Reads and parses a size-bounded JSON object body, throwing on parse or size errors. */
export async function readBoundedJsonObject<T extends JsonBody = JsonBody>(
  req: Request,
  options: { maxBytes?: number; message?: string; code?: string } = {},
): Promise<T> {
  const raw = await readBoundedText(req, options);

  if (!raw.trim()) {
    throw new HttpError(400, options.message ?? "Request body is required", {
      code: options.code ?? "empty_body",
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON body", { code: "invalid_json" });
  }

  if (!isRecord(parsed)) {
    throw new HttpError(400, "Invalid JSON body", { code: "invalid_json" });
  }

  return parsed as T;
}

const DEFAULT_REDACTED_KEYS = [
  "authorization",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "secret",
  "secret_value",
  "service_role_key",
  "client_secret",
  "private_key",
  "cookie",
  "set_cookie",
];

/**
 * Recursively redacts sensitive fields from an arbitrary value so it is safe to
 * log or include in telemetry. Key matching is case-insensitive and ignores
 * separators (so `apiKey`, `api-key`, and `api_key` all match). Cyclic
 * references are collapsed to "[Circular]".
 */
export function redactSensitiveValues(
  value: unknown,
  options: { redactKeys?: readonly string[] } = {},
): unknown {
  const denySet = new Set(
    (options.redactKeys ?? DEFAULT_REDACTED_KEYS).map((key) =>
      key.replace(/[^a-z0-9]/gi, "").toLowerCase(),
    ),
  );
  const seen = new WeakSet<object>();

  const walk = (input: unknown, key?: string): unknown => {
    const normalizedKey = key?.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (normalizedKey && denySet.has(normalizedKey)) {
      return "[REDACTED]";
    }

    if (input === null || typeof input !== "object") {
      return typeof input === "bigint" ? input.toString() : input;
    }

    if (seen.has(input as object)) {
      return "[Circular]";
    }
    seen.add(input as object);

    if (Array.isArray(input)) {
      return input.map((item) => walk(item));
    }

    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        walk(childValue, childKey),
      ]),
    );
  };

  return walk(value);
}

/** Reads and parses the request body as a JSON object. */
export async function readJsonObject<T extends JsonBody = JsonBody>(
  req: Request,
  options: { message?: string; code?: string } = {},
): Promise<T> {
  const body = await readJsonBody<unknown>(req, options);

  if (!isRecord(body)) {
    throw new HttpError(400, options.message ?? "Invalid JSON body", {
      code: options.code ?? "invalid_json",
    });
  }

  return body as T;
}

function getErrorObject(error: unknown) {
  return isRecord(error) ? error : {};
}

/** Resolves the HTTP status code carried by an error-like value. */
export function getErrorStatus(error: unknown, fallbackStatus = 500) {
  if (error instanceof HttpError) {
    return error.status;
  }

  const status = Number(getErrorObject(error).status);
  return Number.isInteger(status) && status >= 400 && status < 600
    ? status
    : fallbackStatus;
}

function getErrorCode(error: unknown) {
  if (error instanceof HttpError) {
    return error.code;
  }

  const code = getErrorObject(error).code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

function getErrorDetails(error: unknown) {
  if (error instanceof HttpError) {
    return error.details;
  }

  return getErrorObject(error).details;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : null;
}

/** Converts an error-like value into a client-facing JSON body. */
export function serializeError(
  error: unknown,
  options: {
    fallbackMessage?: string;
    includeDetails?: boolean;
  } = {},
) {
  const fallbackMessage = options.fallbackMessage ?? "Internal server error";
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  const details = getErrorDetails(error);
  const shouldExposeMessage =
    error instanceof HttpError ? error.exposeDetails : status < 500 || options.includeDetails;

  const body: JsonBody = {
    error: shouldExposeMessage && message ? message : fallbackMessage,
  };

  if (code) {
    body.code = code;
  }

  const shouldExposeDetails = error instanceof HttpError ? error.exposeDetails : options.includeDetails;

  if (typeof details !== "undefined" && shouldExposeDetails) {
    body.details = details;
  } else if (options.includeDetails && message && status >= 500) {
    body.details = message;
  }

  return body;
}

/** Creates a CORS JSON response for an error-like value. */
export function errorResponse(
  error: unknown,
  options: {
    fallbackMessage?: string;
    includeDetails?: boolean;
    fallbackStatus?: number;
  } = {},
) {
  return jsonResponse(
    serializeError(error, {
      fallbackMessage: options.fallbackMessage,
      includeDetails: options.includeDetails,
    }),
    { status: getErrorStatus(error, options.fallbackStatus ?? 500) },
  );
}

/** Reads required environment values or throws a server misconfiguration error. */
export function requireEnvValues<const TNames extends readonly string[]>(
  names: TNames,
  getEnv: (name: string) => string | undefined,
): Record<TNames[number], string> {
  const values = {} as Record<TNames[number], string>;
  const missing: string[] = [];

  for (const name of names) {
    const value = getEnv(name);

    if (!value) {
      missing.push(name);
      continue;
    }

    values[name as TNames[number]] = value;
  }

  if (missing.length > 0) {
    throw new HttpError(500, "Missing required environment variables", {
      code: "server_misconfigured",
      details: { missing },
      exposeDetails: false,
    });
  }

  return values;
}

/** Wraps an Edge Function request handler with CORS, method, and error handling. */
export function createHttpHandler(
  handler: (req: Request) => Response | Promise<Response>,
  options: {
    allowedMethods?: readonly string[];
    preflightStatus?: number;
    methodNotAllowedStatus?: number;
    methodNotAllowedBody?: unknown;
    onError?: (error: unknown, req: Request) => void;
    includeErrorDetails?: boolean;
    internalErrorMessage?: string;
  } = {},
) {
  const allowedMethods = (options.allowedMethods ?? ["POST"]).map((method) => method.toUpperCase());

  return async (req: Request) => {
    if (req.method === "OPTIONS") {
      return preflightResponse(options.preflightStatus);
    }

    if (allowedMethods.length > 0 && !allowedMethods.includes(req.method.toUpperCase())) {
      return methodNotAllowedResponse(allowedMethods, {
        status: options.methodNotAllowedStatus,
        body: options.methodNotAllowedBody,
      });
    }

    try {
      return withCorsHeaders(await handler(req));
    } catch (error) {
      if (error instanceof Response) {
        return withCorsHeaders(error);
      }

      try {
        options.onError?.(error, req);
      } catch (onErrorFailure) {
        console.error("createHttpHandler onError callback failed", onErrorFailure);
      }

      return errorResponse(error, {
        fallbackMessage: options.internalErrorMessage,
        includeDetails: options.includeErrorDetails,
      });
    }
  };
}
