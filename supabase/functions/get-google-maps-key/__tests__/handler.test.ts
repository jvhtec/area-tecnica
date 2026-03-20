import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetGoogleMapsKeyRequest } from "../handler";

function createProfilesBuilder(
  result: { data: { role: string | null; email?: string | null } | null; error: unknown },
) {
  const builder = {
    eq: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(result),
    })),
  };

  return {
    select: vi.fn(() => builder),
  };
}

describe("handleGetGoogleMapsKeyRequest", () => {
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

  it("returns the key and writes a success audit row", async () => {
    const profiles = createProfilesBuilder({
      data: { role: "management", email: "manager@example.com" },
      error: null,
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: (name) => (name === "GOOGLE_MAPS_API_KEY" ? "maps-key" : undefined),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ apiKey: "maps-key" });
    expect(response.headers.get("Cache-Control")).toBe("no-store, private, max-age=0");
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: true,
          outcome: "allowed",
          role: "management",
        }),
      }),
    );
  });

  it("writes an audit row when the caller role is denied", async () => {
    const profiles = createProfilesBuilder({
      data: { role: "technician", email: "tech@example.com" },
      error: null,
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
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

  it("still denies roles outside admin/management even if allowedRoles is wider", async () => {
    const profiles = createProfilesBuilder({
      data: { role: "technician", email: "tech@example.com" },
      error: null,
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management", "technician"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(403);
  });

  it("writes an audit row when the auth token is missing", async () => {
    const supabase = {
      auth: { getUser },
      from: vi.fn(() => ({
        insert: auditInsert,
      })),
    };

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(401);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: false,
          outcome: "missing_authorization",
        }),
      }),
    );
  });

  it("writes an audit row when authentication is invalid", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });
    const supabase = {
      auth: { getUser },
      from: vi.fn(() => ({
        insert: auditInsert,
      })),
    };

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(401);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: false,
          outcome: "invalid_authentication",
        }),
      }),
    );
  });

  it("writes an audit row when the profile is missing", async () => {
    const profiles = createProfilesBuilder({
      data: null,
      error: null,
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(403);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: false,
          outcome: "profile_not_found",
        }),
      }),
    );
  });

  it("writes an audit row when the profile lookup hits a database error", async () => {
    const profiles = createProfilesBuilder({
      data: null,
      error: new Error("db failed"),
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(500);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: false,
          outcome: "db_error",
        }),
      }),
    );
  });

  it("writes an audit row when the key is not configured", async () => {
    const profiles = createProfilesBuilder({
      data: { role: "management", email: "manager@example.com" },
      error: null,
    });
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

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
        },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => undefined,
      },
    );

    expect(response.status).toBe(500);
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        metadata: expect.objectContaining({
          success: false,
          outcome: "key_not_configured",
        }),
      }),
    );
  });
});
