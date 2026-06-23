import { FLEX_API_BASE_URL } from "@/lib/api-config";
import { supabase } from "@/integrations/supabase/client";

interface FlexProxyEnvelope {
  success: boolean;
  status: number;
  statusText?: string;
  contentType?: string;
  data?: unknown;
  rawBody?: string;
  error?: string;
}

export interface FlexApiResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
}

function normalizeFlexEndpoint(input: string): string {
  if (input.startsWith(FLEX_API_BASE_URL)) {
    return input.slice(FLEX_API_BASE_URL.length) || "/";
  }

  if (/^https?:\/\//i.test(input)) {
    throw new Error("Only the configured Flex API origin may be proxied");
  }

  return input.startsWith("/") ? input : `/${input}`;
}

function serializeHeaders(input?: HeadersInit): Record<string, string> {
  const source = new Headers(input);
  const allowed = new Set([
    "accept",
    "content-type",
    "x-api-client",
    "x-requested-with",
  ]);
  const result: Record<string, string> = {};

  source.forEach((value, key) => {
    if (allowed.has(key.toLowerCase())) {
      result[key] = value;
    }
  });

  return result;
}

export async function flexApiFetch(
  endpoint: string,
  init: RequestInit = {},
): Promise<FlexApiResponse> {
  const method = (init.method || "GET").toUpperCase();
  const headers = serializeHeaders(init.headers);
  const body = typeof init.body === "string" ? init.body : undefined;

  if (init.body && typeof init.body !== "string") {
    throw new Error("Flex proxy requests must use a string body");
  }

  const invocation = supabase.functions.invoke<FlexProxyEnvelope>("secure-flex-api", {
    body: {
      endpoint: normalizeFlexEndpoint(endpoint),
      method,
      headers,
      body,
    },
  });

  const canTimeoutLocally = method === "GET" || method === "HEAD";
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = canTimeoutLocally
    ? new Promise<never>((_, reject) => {
        timeoutId = globalThis.setTimeout(
          () => reject(new DOMException("Flex API request timed out", "AbortError")),
          15_000,
        );
      })
    : undefined;
  let result: Awaited<typeof invocation>;
  try {
    result = timeout
      ? await Promise.race([invocation, timeout])
      : await invocation;
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  }

  const { data, error } = result;

  if (error) {
    throw new Error(error.message || "Flex API proxy request failed");
  }

  if (!data || typeof data.status !== "number") {
    throw new Error("Flex API proxy returned an invalid response");
  }

  const responseHeaders = new Headers();
  if (data.contentType) {
    responseHeaders.set("content-type", data.contentType);
  }

  return {
    ok: data.success,
    status: data.status,
    statusText: data.statusText || data.error || "",
    headers: responseHeaders,
    json: async <T>() => {
      if (data.data !== undefined) {
        return data.data as T;
      }
      if (data.rawBody) {
        return JSON.parse(data.rawBody) as T;
      }
      return null as T;
    },
    text: async () => {
      if (data.rawBody !== undefined) {
        return data.rawBody;
      }
      return data.data === undefined ? "" : JSON.stringify(data.data);
    },
  };
}
