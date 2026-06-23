import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetSecretRequest } from "../handler";

describe("handleGetSecretRequest", () => {
  const getUser = vi.fn();
  const auditInsert = vi.fn();
  const supabase = {
    auth: { getUser },
    from: vi.fn(() => ({
      insert: auditInsert,
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    auditInsert.mockResolvedValue({ error: null });
  });

  it("never returns a secret to an authenticated caller", async () => {
    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
        body: JSON.stringify({ secretName: "X_AUTH_TOKEN" }),
      }),
      { supabase },
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error:
        "Direct secret delivery is disabled. Use an approved server-side operation.",
    });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "secret_access_blocked",
        resource: "secret:X_AUTH_TOKEN",
        severity: "high",
        metadata: expect.objectContaining({
          success: false,
          outcome: "direct_secret_delivery_disabled",
        }),
      }),
    );
  });

  it("requires authentication", async () => {
    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        body: JSON.stringify({ secretName: "OPENAI_API_KEY" }),
      }),
      { supabase },
    );

    expect(response.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects invalid authentication", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });

    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        headers: { authorization: "Bearer invalid" },
        body: JSON.stringify({ secretName: "GOOGLE_MAPS_API_KEY" }),
      }),
      { supabase },
    );

    expect(response.status).toBe(401);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: "invalid_authentication",
        }),
      }),
    );
  });

  it("fails closed when the audit write fails", async () => {
    auditInsert.mockResolvedValue({ error: new Error("audit failed") });

    await expect(
      handleGetSecretRequest(
        new Request("https://example.com/get-secret", {
          method: "POST",
          headers: { authorization: "Bearer token-1" },
          body: JSON.stringify({ secretName: "X_AUTH_TOKEN" }),
        }),
        { supabase },
      ),
    ).rejects.toThrow("Failed to persist security audit log");
  });
});
