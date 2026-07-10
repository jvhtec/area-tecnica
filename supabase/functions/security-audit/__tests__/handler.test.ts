import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleSecurityAuditRequest } from "../handler";

describe("handleSecurityAuditRequest", () => {
  const insert = vi.fn();
  const anonymousInsert = vi.fn();
  const getUser = vi.fn();
  const rpc = vi.fn();
  const supabase = {
    auth: {
      getUser,
    },
    from: vi.fn((table: string) => ({
      insert: table === "anonymous_security_audit_log" ? anonymousInsert : insert,
    })),
    rpc,
  };
  const deps = { supabase, rateLimitSalt: "test-rate-limit-salt" };

  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    anonymousInsert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({
      data: {
        allowed: true,
        remaining: 19,
        reset_at: "2026-07-10T22:00:00.000Z",
        retry_after_seconds: 0,
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "jwt-user",
          email: "jwt@example.com",
        },
      },
      error: null,
    });
  });

  it("persists a valid audit row and prefers the JWT user id", async () => {
    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "x-forwarded-for": "203.0.113.9, 10.0.0.1",
          "user-agent": "Vitest",
        },
        body: JSON.stringify({
          user_id: "spoofed-user",
          action: "auth_login",
          resource: "authentication",
          severity: "low",
          metadata: {
            success: true,
            secretValue: "do-not-store",
          },
        }),
      }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "jwt-user",
        ip_address: "203.0.113.9",
        user_agent: "Vitest",
        metadata: {
          success: true,
          secretValue: "[REDACTED]",
        },
      }),
    );
  });

  it("rejects malformed payloads", async () => {
    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        body: JSON.stringify({
          action: "",
          resource: "authentication",
          severity: "low",
        }),
      }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("ignores a spoofed user id and stores an allowlisted pre-auth event separately", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        headers: { authorization: "Bearer anon-project-token" },
        body: JSON.stringify({
          user_id: "spoofed-user",
          action: "auth_login",
          resource: "authentication",
          severity: "high",
          metadata: { success: false, email: "person@example.com", error_code: "invalid_login" },
        }),
      }),
      deps,
    );

    expect(response.status).toBe(201);
    expect(insert).not.toHaveBeenCalled();
    expect(anonymousInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: "auth_login",
      metadata: { success: false, error_code: "invalid_login" },
    }));
    expect(anonymousInsert.mock.calls[0][0]).not.toHaveProperty("user_id");
  });

  it("rejects non-authentication anonymous events", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        body: JSON.stringify({
          user_id: "spoofed-user",
          action: "suspicious_activity",
          resource: "system",
          severity: "critical",
        }),
      }),
      deps,
    );

    expect(response.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
    expect(anonymousInsert).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before persistence", async () => {
    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        headers: { "content-length": String(20 * 1024) },
        body: JSON.stringify({ action: "auth_login" }),
      }),
      deps,
    );

    expect(response.status).toBe(413);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 429 when the durable rate limit is exhausted", async () => {
    rpc.mockResolvedValue({
      data: {
        allowed: false,
        remaining: 0,
        reset_at: "2026-07-10T22:00:00.000Z",
        retry_after_seconds: 45,
      },
      error: null,
    });

    const response = await handleSecurityAuditRequest(
      new Request("https://example.com/security-audit", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
        body: JSON.stringify({
          action: "auth_login",
          resource: "authentication",
          severity: "low",
        }),
      }),
      deps,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("45");
    expect(insert).not.toHaveBeenCalled();
  });
});
