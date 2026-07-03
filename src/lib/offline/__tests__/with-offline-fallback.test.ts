import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithOfflineFallback } from "../with-offline-fallback";

// Node has no navigator by default, so isBrowserOnline() reports online;
// the browser-offline branch is exercised by stubbing navigator below.

const never = () => new Promise<string>(() => {});

describe("fetchWithOfflineFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves the snapshot immediately when the browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const online = vi.fn(async () => "online");
    const result = await fetchWithOfflineFallback({
      online,
      offline: async () => "offline",
    });

    expect(result).toEqual({ data: "offline", fromOffline: true });
    expect(online).not.toHaveBeenCalled();
  });

  it("throws immediately when the browser is offline and there is no snapshot", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    await expect(
      fetchWithOfflineFallback({
        online: async () => "online",
        offline: async (): Promise<string | null> => null,
      }),
    ).rejects.toThrow("Sin conexión y sin copia offline de este festival");
  });
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
