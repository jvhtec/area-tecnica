import { describe, expect, it, vi } from "vitest";

import {
  buildRateLimitIdentifierHash,
  checkEdgeRateLimit,
  consumeEdgeRateLimit,
  getClientIp,
  rateLimitExceededError,
  rateLimitHeaders,
  sha256Hex,
  type EdgeRateLimitClient,
} from "./rateLimit.ts";

function makeClient(result: {
  data?:
    | Array<{ allowed: boolean; remaining: number; reset_at: string; retry_after_seconds: number }>
    | { allowed: boolean; remaining: number; reset_at: string; retry_after_seconds: number }
    | null;
  error?: { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  const client: EdgeRateLimitClient = { rpc };
  return { client, rpc };
}

describe("shared Edge Function rate-limit helpers", () => {
  it("extracts the best available client IP without storing full forwarding chains", () => {
    expect(getClientIp(new Request("https://example.com", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
      },
    }))).toBe("203.0.113.10");

    expect(getClientIp(new Request("https://example.com", {
      headers: {
        "cf-connecting-ip": "2001:db8::1",
        "x-forwarded-for": "203.0.113.10",
      },
    }))).toBe("2001:db8::1");

    expect(getClientIp(new Request("https://example.com"))).toBe("unknown");
  });

  it("builds deterministic hashed bucket identifiers with optional secret salt", async () => {
    const request = new Request("https://example.com", {
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "vitest",
      },
    });

    const first = await buildRateLimitIdentifierHash(request, ["token-1"], { salt: "salt-a" });
    const again = await buildRateLimitIdentifierHash(request, ["token-1"], { salt: "salt-a" });
    const differentSalt = await buildRateLimitIdentifierHash(request, ["token-1"], { salt: "salt-b" });
    const noNetworkParts = await buildRateLimitIdentifierHash(
      request,
      ["token-1"],
      { salt: "salt-a", includeIp: false, includeUserAgent: false },
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(again);
    expect(first).not.toBe(differentSalt);
    expect(first).not.toBe(noNetworkParts);
    expect(first).not.toContain("token-1");
  });

  it("hashes arbitrary values with SHA-256 hex encoding", async () => {
    await expect(sha256Hex("area-tecnica")).resolves.toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps successful RPC responses", async () => {
    const resetAt = new Date("2026-06-24T12:00:00Z").toISOString();
    const { client, rpc } = makeClient({
      data: [{ allowed: true, remaining: 4, reset_at: resetAt, retry_after_seconds: 0 }],
    });

    const result = await consumeEdgeRateLimit({
      supabase: client,
      scope: "test-scope",
      identifierHash: "a".repeat(64),
      windowSeconds: 60,
      maxRequests: 5,
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 4,
      resetAt,
      retryAfterSeconds: 0,
      limit: 5,
      windowSeconds: 60,
    });
    expect(rpc).toHaveBeenCalledWith("consume_edge_rate_limit", {
      p_scope: "test-scope",
      p_identifier_hash: "a".repeat(64),
      p_window_seconds: 60,
      p_max_requests: 5,
    });
  });

  it("supports single-row RPC responses and rate-limit headers", async () => {
    const resetAt = new Date("2026-06-24T12:05:00Z").toISOString();
    const { client } = makeClient({
      data: { allowed: false, remaining: 0, reset_at: resetAt, retry_after_seconds: 42 },
    });

    const result = await consumeEdgeRateLimit({
      supabase: client,
      scope: "test-scope",
      identifierHash: "a".repeat(64),
      windowSeconds: 300,
      maxRequests: 1,
    });

    expect(result.allowed).toBe(false);
    expect(rateLimitHeaders(result)).toEqual({
      "Retry-After": "42",
      "X-RateLimit-Limit": "1",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(Date.parse(resetAt) / 1000)),
    });
    expect(rateLimitExceededError(result)).toMatchObject({
      status: 429,
      code: "rate_limited",
    });
  });

  it("fails closed when the durable limiter RPC is unavailable", async () => {
    const { client } = makeClient({ error: { message: "function missing" } });

    await expect(consumeEdgeRateLimit({
      supabase: client,
      scope: "test-scope",
      identifierHash: "a".repeat(64),
      windowSeconds: 60,
      maxRequests: 5,
    })).rejects.toThrow("function missing");
  });

  it("combines request bucket hashing with the RPC consume call", async () => {
    const resetAt = new Date("2026-06-24T12:00:00Z").toISOString();
    const { client, rpc } = makeClient({
      data: { allowed: true, remaining: 9, reset_at: resetAt, retry_after_seconds: 0 },
    });

    await expect(checkEdgeRateLimit({
      req: new Request("https://example.com", {
        headers: { "x-real-ip": "203.0.113.20", "user-agent": "vitest" },
      }),
      supabase: client,
      scope: "combined",
      identifierParts: ["token-2"],
      windowSeconds: 60,
      maxRequests: 10,
      salt: "salt",
    })).resolves.toMatchObject({ allowed: true, remaining: 9 });

    expect(rpc).toHaveBeenCalledWith("consume_edge_rate_limit", expect.objectContaining({
      p_scope: "combined",
      p_window_seconds: 60,
      p_max_requests: 10,
      p_identifier_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
  });
});
