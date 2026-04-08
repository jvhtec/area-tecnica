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

  it("returns 500 when the profile lookup fails with a database error", async () => {
    const profiles = createProfilesBuilder({ data: null, error: new Error("db failed") });
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

    expect(response.status).toBe(500);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: "db_error",
        }),
      }),
    );
  });

  it("fails closed when the success audit write fails", async () => {
    const profiles = createProfilesBuilder({ data: { role: "management" }, error: null });
    const supabase = {
      auth: { getUser },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return profiles;
        }

        return {
          insert: vi.fn().mockResolvedValue({ error: new Error("audit failed") }),
        };
      }),
    };

    await expect(
      handleGetSecretRequest(
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
      ),
    ).rejects.toThrow("Failed to persist security audit log");
  });

  it("truncates oversized secret names in the audit resource", async () => {
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
    const oversizedSecretName = "A".repeat(400);

    const response = await handleGetSecretRequest(
      new Request("https://example.com/get-secret", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
        body: JSON.stringify({ secretName: oversizedSecretName }),
      }),
      {
        supabase,
        getEnv: () => "super-secret-value",
      },
    );

    expect(response.status).toBe(403);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: expect.any(String),
        metadata: expect.objectContaining({
          secret_name: oversizedSecretName,
          secret_name_truncated: true,
        }),
      }),
    );
    expect(auditInsert.mock.calls[0][0].resource.length).toBeLessThanOrEqual(255);
  });
});
