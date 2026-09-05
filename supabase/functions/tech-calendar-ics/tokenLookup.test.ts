import { describe, expect, it, vi } from "vitest";

import { resolveCalendarToken } from "./tokenLookup";

describe("resolveCalendarToken", () => {
  it("uses the vault token after migration", async () => {
    const readLegacyToken = vi.fn();
    const result = await resolveCalendarToken({
      readVaultToken: vi.fn().mockResolvedValue({ token: "vault-token", error: null }),
      readLegacyToken,
    }, "profile-id");

    expect(result).toEqual({ token: "vault-token", error: null });
    expect(readLegacyToken).not.toHaveBeenCalled();
  });

  it("uses the legacy token only before the vault migration", async () => {
    const readLegacyToken = vi.fn().mockResolvedValue({ token: "legacy-token", error: null });
    const result = await resolveCalendarToken({
      readVaultToken: vi.fn().mockResolvedValue({
        token: null,
        error: { code: "PGRST205", message: "profile_calendar_tokens is not in the schema cache" },
      }),
      readLegacyToken,
    }, "profile-id");

    expect(result).toEqual({ token: "legacy-token", error: null });
    expect(readLegacyToken).toHaveBeenCalledWith("profile-id");
  });

  it("fails closed on vault errors after migration", async () => {
    const readLegacyToken = vi.fn().mockResolvedValue({ token: "disclosed-token", error: null });
    const vaultError = { code: "42501", message: "permission denied" };
    const result = await resolveCalendarToken({
      readVaultToken: vi.fn().mockResolvedValue({ token: null, error: vaultError }),
      readLegacyToken,
    }, "profile-id");

    expect(result).toEqual({ token: null, error: vaultError });
    expect(readLegacyToken).not.toHaveBeenCalled();
  });

  it("does not revive a legacy token when the vault has no row", async () => {
    const readLegacyToken = vi.fn().mockResolvedValue({ token: "legacy-token", error: null });
    const result = await resolveCalendarToken({
      readVaultToken: vi.fn().mockResolvedValue({ token: null, error: null }),
      readLegacyToken,
    }, "profile-id");

    expect(result).toEqual({ token: null, error: null });
    expect(readLegacyToken).not.toHaveBeenCalled();
  });
});
