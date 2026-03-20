import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetSecretRequest } from "../handler";

function createProfilesBuilder(result: { data: { role: string | null } | null; error: unknown }) {
  const builder = {
    eq: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(result),
    })),
  };

  return {
    select: vi.fn(() => builder),
  };
}

describe("handleGetSecretRequest", () => {
  const getUser = vi.fn();
  const auditInsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
        },
      },
      error: null,
    });
    auditInsert.mockResolvedValue({ error: null });
  });

  it("returns the secret and writes a success audit row", async () => {
    const profiles = createProfilesBuilder({ data: { role: "management" }, error: null });
    const supabase = {
      auth: { getUser },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return profiles;
        }

        return {
          insert: auditInsert,
        };
      }),
    };

    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "user-agent": "Vitest",
        },
        body: JSON.stringify({ secretName: "OPENAI_API_KEY" }),
      }),
      {
        supabase,
        getEnv: (name) => (name === "OPENAI_API_KEY" ? "super-secret-value" : undefined),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ OPENAI_API_KEY: "super-secret-value" });
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "secret_access",
        resource: "secret:OPENAI_API_KEY",
        metadata: expect.objectContaining({
          success: true,
          secret_name: "OPENAI_API_KEY",
        }),
      }),
    );
    expect(auditInsert.mock.calls[0][0].metadata).not.toHaveProperty("secret_value");
  });

  it("writes an audit row when the caller lacks permission", async () => {
    const profiles = createProfilesBuilder({ data: { role: "technician" }, error: null });
    const supabase = {
      auth: { getUser },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return profiles;
        }

        return {
          insert: auditInsert,
        };
      }),
    };

    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
        body: JSON.stringify({ secretName: "OPENAI_API_KEY" }),
      }),
      {
        supabase,
        getEnv: () => "super-secret-value",
      },
    );

    expect(response.status).toBe(403);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          success: false,
          outcome: "insufficient_permissions",
          role: "technician",
        }),
      }),
    );
  });
});
