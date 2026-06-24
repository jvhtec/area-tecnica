import { type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { describe, expect, it, vi } from "vitest";

import {
  isServiceRoleRequest,
  requireAdminOrManagement,
  requireAuthenticatedRole,
  requireServiceRoleRequest,
} from "./auth.ts";

type ProfileError = {
  message: string;
};

function requestWithToken(token = "token-1") {
  return new Request("https://example.com", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function createSupabaseStub(options: {
  user?: User | null;
  authError?: ProfileError | null;
  role?: string | null;
  profileError?: ProfileError | null;
}) {
  const user = typeof options.user === "undefined"
    ? ({ id: "user-1" } as User)
    : options.user;
  const authError = options.authError ?? null;
  const profileError = options.profileError ?? null;
  const maybeSingle = vi.fn(async () => ({
    data: profileError ? null : { role: options.role ?? "admin" },
    error: profileError,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn(async () => ({
    data: { user },
    error: authError,
  }));

  return {
    supabase: {
      auth: { getUser },
      from,
    } as unknown as SupabaseClient,
    getUser,
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe("shared Edge Function auth helpers", () => {
  it("returns a normalized privileged caller for admin or management roles", async () => {
    const { supabase } = createSupabaseStub({ role: "Management" });

    await expect(requireAdminOrManagement(supabase, requestWithToken("jwt-1"))).resolves.toMatchObject({
      userId: "user-1",
      role: "management",
      token: "jwt-1",
      authorizationHeader: "Bearer jwt-1",
    });
  });

  it("rejects missing and invalid bearer tokens", async () => {
    const missing = createSupabaseStub({});
    await expect(requireAdminOrManagement(missing.supabase, new Request("https://example.com"))).rejects.toMatchObject({
      status: 401,
      code: "missing_authorization",
    });
    expect(missing.getUser).not.toHaveBeenCalled();

    const invalid = createSupabaseStub({
      user: null,
      authError: { message: "expired" },
    });
    await expect(requireAdminOrManagement(invalid.supabase, requestWithToken())).rejects.toMatchObject({
      status: 401,
      code: "invalid_authorization",
    });
  });

  it("rejects callers outside the allowed roles", async () => {
    const onForbidden = vi.fn();
    const { supabase } = createSupabaseStub({ role: "technician" });

    await expect(requireAdminOrManagement(supabase, requestWithToken(), { onForbidden })).rejects.toMatchObject({
      status: 403,
      code: "insufficient_role",
    });
    expect(onForbidden).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      role: "technician",
    }));
  });

  it("keeps denial hook failures from masking the authorization rejection", async () => {
    const onForbidden = vi.fn(async () => {
      throw new Error("audit write failed");
    });
    const { supabase } = createSupabaseStub({ role: "technician" });

    await expect(requireAdminOrManagement(supabase, requestWithToken(), {
      onForbidden,
    })).rejects.toMatchObject({
      status: 403,
      code: "insufficient_role",
    });
    expect(onForbidden).toHaveBeenCalledOnce();
  });

  it("keeps profile lookup failures opaque to clients", async () => {
    const { supabase } = createSupabaseStub({
      profileError: { message: "database password leaked" },
    });

    await expect(requireAdminOrManagement(supabase, requestWithToken())).rejects.toMatchObject({
      status: 500,
      code: "authorization_lookup_failed",
      exposeDetails: false,
    });
  });

  it("supports custom role sets for non-admin privileged functions", async () => {
    const { supabase } = createSupabaseStub({ role: "Logistics" });

    await expect(requireAuthenticatedRole(supabase, requestWithToken(), {
      allowedRoles: new Set(["ADMIN", "MANAGEMENT", "LOGISTICS"]),
    })).resolves.toMatchObject({
      role: "logistics",
    });
  });

  it("detects service-role requests from bearer or apikey headers without exposing partial matches", () => {
    const serviceRoleKey = "service-role-secret";

    expect(isServiceRoleRequest(new Request("https://example.com", {
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
    }), serviceRoleKey)).toBe(true);

    expect(isServiceRoleRequest(new Request("https://example.com", {
      headers: { apikey: serviceRoleKey },
    }), serviceRoleKey)).toBe(true);

    expect(isServiceRoleRequest(new Request("https://example.com", {
      headers: { Authorization: "Bearer service-role" },
    }), serviceRoleKey)).toBe(false);
  });

  it("throws a structured forbidden error when service-role authorization is absent", () => {
    try {
      requireServiceRoleRequest(new Request("https://example.com"), "service-role-secret");
      throw new Error("expected requireServiceRoleRequest to throw");
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: "service_role_required",
      });
    }
  });
});
