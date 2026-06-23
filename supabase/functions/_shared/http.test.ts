import { describe, expect, it, vi } from "vitest";

import {
  correlationHeaders,
  createHttpHandler,
  errorResponse,
  extractBearerToken,
  getCorrelationId,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  readBoundedText,
  readJsonBody,
  redactSensitiveValues,
  requireBearerToken,
  requireEnvValues,
} from "./http.ts";

describe("shared Edge Function HTTP helpers", () => {
  it("creates JSON responses with CORS headers", async () => {
    const response = jsonResponse({ ok: true }, 201);

    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("extracts and requires bearer tokens case-insensitively", () => {
    const request = new Request("https://example.com", {
      headers: { Authorization: "Bearer token-1" },
    });

    expect(extractBearerToken(request)).toBe("token-1");
    expect(requireBearerToken(request)).toBe("token-1");
    expect(() => requireBearerToken(new Request("https://example.com"))).toThrow(HttpError);
  });

  it("turns invalid JSON into an HttpError", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: "{",
    });

    await expect(readJsonBody(request)).rejects.toMatchObject({
      status: 400,
      code: "invalid_json",
    });
  });

  it("wraps preflight, method checks, thrown responses, and errors", async () => {
    const handler = vi.fn(async (req: Request) => {
      const url = new URL(req.url);
      if (url.searchParams.get("mode") === "response") {
        throw new Response("custom", { status: 418 });
      }
      if (url.searchParams.get("mode") === "error") {
        throw new HttpError(422, "Nope", { code: "nope" });
      }

      return new Response("plain");
    });
    const wrapped = createHttpHandler(handler, { allowedMethods: ["POST"] });

    const preflight = await wrapped(new Request("https://example.com", { method: "OPTIONS" }));
    expect(preflight.status).toBe(204);
    expect(handler).not.toHaveBeenCalled();

    const wrongMethod = await wrapped(new Request("https://example.com", { method: "GET" }));
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("POST");

    const thrownResponse = await wrapped(new Request("https://example.com?mode=response", { method: "POST" }));
    expect(thrownResponse.status).toBe(418);
    expect(thrownResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const plainResponse = await wrapped(new Request("https://example.com", { method: "POST" }));
    expect(plainResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const thrownError = await wrapped(new Request("https://example.com?mode=error", { method: "POST" }));
    expect(thrownError.status).toBe(422);
    await expect(thrownError.json()).resolves.toEqual({ error: "Nope", code: "nope" });
  });

  it("serializes unexpected errors without exposing details by default", async () => {
    const response = errorResponse(new Error("database password leaked"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("still returns an error response when the error logger throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const wrapped = createHttpHandler(
      async () => {
        throw new Error("database password leaked");
      },
      {
        onError: () => {
          throw new Error("logger failed");
        },
      },
    );

    try {
      const response = await wrapped(new Request("https://example.com", { method: "POST" }));

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
      expect(consoleError).toHaveBeenCalledWith(
        "createHttpHandler onError callback failed",
        expect.any(Error),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reuses a well-formed inbound correlation id and generates otherwise", () => {
    const withHeader = new Request("https://example.com", {
      headers: { "x-correlation-id": "abc12345-trace-id" },
    });
    expect(getCorrelationId(withHeader)).toBe("abc12345-trace-id");

    const malformed = new Request("https://example.com", {
      headers: { "x-correlation-id": "bad id!" },
    });
    const generated = getCorrelationId(malformed);
    expect(generated).not.toBe("bad id!");
    expect(generated.length).toBeGreaterThanOrEqual(8);

    expect(correlationHeaders("trace-123")).toEqual({ "x-correlation-id": "trace-123" });
  });

  it("rejects oversized bodies via Content-Length and decoded size", async () => {
    const declared = new Request("https://example.com", {
      method: "POST",
      headers: { "content-length": "5000" },
      body: "{}",
    });
    await expect(readBoundedText(declared, { maxBytes: 1000 })).rejects.toMatchObject({
      status: 413,
      code: "payload_too_large",
    });

    const oversized = new Request("https://example.com", {
      method: "POST",
      body: "x".repeat(2000),
    });
    await expect(readBoundedText(oversized, { maxBytes: 1000 })).rejects.toMatchObject({
      status: 413,
    });

    const ok = new Request("https://example.com", { method: "POST", body: "small" });
    await expect(readBoundedText(ok, { maxBytes: 1000 })).resolves.toBe("small");
  });

  it("parses bounded JSON objects and rejects non-objects/empties", async () => {
    const object = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readBoundedJsonObject(object)).resolves.toEqual({ ok: true });

    const array = new Request("https://example.com", { method: "POST", body: "[1,2]" });
    await expect(readBoundedJsonObject(array)).rejects.toMatchObject({ status: 400, code: "invalid_json" });

    const empty = new Request("https://example.com", { method: "POST", body: "   " });
    await expect(readBoundedJsonObject(empty)).rejects.toMatchObject({ status: 400, code: "empty_body" });
  });

  it("redacts sensitive fields recursively regardless of key separators", () => {
    const redacted = redactSensitiveValues({
      email: "user@example.com",
      apiKey: "secret-1",
      nested: { "refresh-token": "secret-2", keep: 1 },
      list: [{ password: "secret-3" }],
    });

    expect(redacted).toEqual({
      email: "user@example.com",
      apiKey: "[REDACTED]",
      nested: { "refresh-token": "[REDACTED]", keep: 1 },
      list: [{ password: "[REDACTED]" }],
    });
  });

  it("collapses circular references when redacting", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;

    expect(redactSensitiveValues(cyclic)).toEqual({ name: "x", self: "[Circular]" });
  });

  it("validates required environment values", () => {
    const values = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => (
      name === "SUPABASE_URL" ? "http://localhost" : "service-role"
    ));

    expect(values.SUPABASE_URL).toBe("http://localhost");
    expect(values.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role");
    expect(() => requireEnvValues(["MISSING"] as const, () => undefined)).toThrow(HttpError);
  });
});
