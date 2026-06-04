import { corsHeaders, jsonResponse as corsJsonResponse } from "./cors.ts";

export { corsHeaders };

type JsonBody = Record<string, unknown>;

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

export function jsonResponse(body: unknown, init?: ResponseInit | number) {
  return corsJsonResponse(
    body,
    typeof init === "number" ? { status: init } : init,
  );
}

export function preflightResponse(status = 204) {
  return new Response(null, { status, headers: corsHeaders });
}

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

export function extractBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

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

      options.onError?.(error, req);
      return errorResponse(error, {
        fallbackMessage: options.internalErrorMessage,
        includeDetails: options.includeErrorDetails,
      });
    }
  };
}
