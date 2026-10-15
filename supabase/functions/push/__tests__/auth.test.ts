import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../deps.ts";

// config.ts reads Deno env at import time.
vi.mock("../config.ts", () => ({ SERVICE_ROLE_KEY: "service-key" }));
vi.mock("../http.ts", () => ({ corsHeaders: {} }));

import { resolveCaller } from "../auth.ts";

const clientWith = (getUser: ReturnType<typeof vi.fn>) =>
  ({ auth: { getUser } }) as unknown as SupabaseClient;

describe("resolveCaller", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: (name: string) => (name === "PUSH_INTERNAL_TOKEN" ? "internal-token" : undefined) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts the service key without asking Auth to validate it as a user JWT", async () => {
    const getUser = vi.fn();
    await expect(resolveCaller(clientWith(getUser), "service-key", true))
      .resolves.toEqual({ userId: "00000000-0000-0000-0000-000000000000", isService: true });
    await expect(resolveCaller(clientWith(getUser), "internal-token", true))
      .resolves.toMatchObject({ isService: true });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("does not treat the service key as a caller where service access is not allowed", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "bad_jwt" } });
    await expect(resolveCaller(clientWith(getUser), "service-key", false)).rejects.toBeInstanceOf(Response);
    expect(getUser).toHaveBeenCalledWith("service-key");
  });

  it("resolves user tokens through Auth", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    await expect(resolveCaller(clientWith(getUser), "user-jwt", true))
      .resolves.toEqual({ userId: "user-1", isService: false });
  });

  it("rejects unknown tokens", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    await expect(resolveCaller(clientWith(getUser), "nope", true)).rejects.toBeInstanceOf(Response);
  });
});
