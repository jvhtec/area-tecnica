import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetGoogleMapsKeyRequest } from "../handler";

describe("handleGetGoogleMapsKeyRequest (deprecated)", () => {
  const getUser = vi.fn();
  const auditInsert = vi.fn();

  const createSupabase = () => ({
    auth: { getUser },
    from: vi.fn(() => ({
      insert: auditInsert,
    })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    auditInsert.mockResolvedValue({ error: null });
  });

  it("returns 410 Gone and never returns the API key", async () => {
    const supabase = createSupabase();

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
      }),
      {
        supabase,
        allowedRoles: ["management"],
        getEnv: () => "maps-key",
      },
    );

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body).not.toHaveProperty("apiKey");
    expect(body.error).toContain("deprecated");
  });

  it("audits the deprecated access attempt with the resolved user id", async () => {
    const supabase = createSupabase();

    await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
      }),
      { supabase, allowedRoles: ["management"], getEnv: () => "maps-key" },
    );

    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "google_maps_key_access",
        user_id: "user-1",
        metadata: expect.objectContaining({
          success: false,
          outcome: "deprecated_endpoint",
        }),
      }),
    );
  });

  it("still responds 410 when no auth token is supplied", async () => {
    const supabase = createSupabase();

    const response = await handleGetGoogleMapsKeyRequest(
      new Request("https://example.com/get-google-maps-key", {
        method: "POST",
      }),
      { supabase, allowedRoles: ["management"], getEnv: () => "maps-key" },
    );

    expect(response.status).toBe(410);
    expect(getUser).not.toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: "deprecated_endpoint",
        }),
      }),
    );
  });
});
