import { describe, expect, it, vi } from "vitest";

import {
  createHttpHandler,
  errorResponse,
  extractBearerToken,
  HttpError,
  jsonResponse,
  readJsonBody,
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

  it("validates required environment values", () => {
    const values = requireEnvValues(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const, (name) => (
      name === "SUPABASE_URL" ? "http://localhost" : "service-role"
    ));

    expect(values.SUPABASE_URL).toBe("http://localhost");
    expect(values.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role");
    expect(() => requireEnvValues(["MISSING"] as const, () => undefined)).toThrow(HttpError);
  });
});
