import { describe, expect, it } from "vitest";

import { fetchWithOfflineFallback } from "../with-offline-fallback";

// Node has no navigator, so isBrowserOnline() reports online here; the
// browser-offline branch is exercised indirectly via the error paths.

const never = () => new Promise<string>(() => {});

describe("fetchWithOfflineFallback", () => {
  it("returns online data when the fetch answers in time", async () => {
    const result = await fetchWithOfflineFallback({
      online: async () => "online",
      offline: async () => "offline",
      timeoutMs: 50,
    });
    expect(result).toEqual({ data: "online", fromOffline: false });
  });

  it("serves the snapshot when the online fetch exceeds the timeout", async () => {
    const result = await fetchWithOfflineFallback({
      online: never,
      offline: async () => "offline",
      timeoutMs: 20,
    });
    expect(result).toEqual({ data: "offline", fromOffline: true });
  });

  it("keeps waiting for the network on timeout when there is no snapshot", async () => {
    const result = await fetchWithOfflineFallback({
      online: () => new Promise<string>((resolve) => setTimeout(() => resolve("slow-online"), 40)),
      offline: async (): Promise<string | null> => null,
      timeoutMs: 10,
    });
    expect(result).toEqual({ data: "slow-online", fromOffline: false });
  });

  it("serves the snapshot when the online fetch fails", async () => {
    const result = await fetchWithOfflineFallback({
      online: async (): Promise<string> => {
        throw new Error("network down");
      },
      offline: async () => "offline",
      timeoutMs: 50,
    });
    expect(result).toEqual({ data: "offline", fromOffline: true });
  });

  it("rethrows the online error when there is no snapshot", async () => {
    await expect(
      fetchWithOfflineFallback({
        online: async () => {
          throw new Error("network down");
        },
        offline: async (): Promise<string | null> => null,
        timeoutMs: 50,
      }),
    ).rejects.toThrow("network down");
  });
});
