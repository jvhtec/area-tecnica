import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleSecurityAuditRequest } from "../handler";

describe("handleSecurityAuditRequest", () => {
  const insert = vi.fn();
  const getUser = vi.fn();
  const supabase = {
    auth: {
      getUser,
    },
    from: vi.fn(() => ({
      insert,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
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
      { supabase },
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
      { supabase },
    );

    expect(response.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
