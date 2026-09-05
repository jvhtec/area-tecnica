import { capturePrivateDataScope, setPrivateDataIdentity } from "@/lib/private-data-scope";
import { __resetOfflineDbForTests, offlineDb, SNAPSHOT_STORE, FILES_STORE, QUEUE_STORE } from "../offline-db";
import { __resetOfflineRevocationsForTests } from "../offline-revocation";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithOfflineFallback } from "../with-offline-fallback";

// Node has no navigator by default, so isBrowserOnline() reports online;
// the browser-offline branch is exercised by stubbing navigator below.

const never = () => new Promise<string>(() => {});

describe("fetchWithOfflineFallback", () => {
  beforeEach(() => {
    __resetOfflineDbForTests();
    __resetOfflineRevocationsForTests();
    setPrivateDataIdentity("account-a", "management:sound");
  });
  afterEach(() => {
    setPrivateDataIdentity(null);
    vi.unstubAllGlobals();
  });

  it("withdraws cached data after a late authorization denial and preserves unsent edits", async () => {
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job", secret: "private snapshot" });
    await offlineDb.put(FILES_STORE, { key: "rider", jobId: "job", blob: new Blob(["private rider"]) });
    await offlineDb.put(QUEUE_STORE, { id: "unsent", jobId: "job" });
    const scope = capturePrivateDataScope();
    let deny!: (error: unknown) => void;
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: () => new Promise<string>((_resolve, reject) => { deny = reject; }),
      offline: async () => "private snapshot",
      timeoutMs: 1,
    });
    expect(result.fromOffline).toBe(true);
    deny({ code: "42501", message: "permission denied" });
    await vi.waitFor(() => expect(scope.signal.aborted).toBe(true));
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toMatchObject({ accessRevoked: true });
    expect(await offlineDb.get(FILES_STORE, "rider")).toBeNull();
    expect(await offlineDb.getAll(QUEUE_STORE)).toHaveLength(1);
  });

  it("does not revoke the next account's snapshot when the previous request fails late", async () => {
    let deny!: (error: unknown) => void;
    await fetchWithOfflineFallback({
      jobId: "job",
      online: () => new Promise<string>((_resolve, reject) => { deny = reject; }),
      offline: async () => "A snapshot",
      timeoutMs: 1,
    });
    setPrivateDataIdentity("account-b", "management:sound");
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job", secret: "B snapshot" });
    deny({ status: 403, message: "forbidden" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toMatchObject({ secret: "B snapshot" });
  });

  it("does not retry a failing offline reader", async () => {
    const offline = vi.fn(async (): Promise<string> => { throw new TypeError("Failed to fetch"); });
    await expect(fetchWithOfflineFallback({ jobId: "job", online: never, offline, timeoutMs: 1 })).rejects.toThrow("Failed to fetch");
    expect(offline).toHaveBeenCalledTimes(1);
  });

  it("serves the snapshot immediately when the browser is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });

    const online = vi.fn(async () => "online");
    const result = await fetchWithOfflineFallback({
      jobId: "job",
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
        jobId: "job",
        online: async () => "online",
        offline: async (): Promise<string | null> => null,
      }),
    ).rejects.toThrow("Sin conexión y sin copia offline de este festival");
  });
  it("returns online data when the fetch answers in time", async () => {
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: async () => "online",
      offline: async () => "offline",
      timeoutMs: 50,
    });
    expect(result).toEqual({ data: "online", fromOffline: false });
  });

  it("serves the snapshot when the online fetch exceeds the timeout", async () => {
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: never,
      offline: async () => "offline",
      timeoutMs: 20,
    });
    expect(result).toEqual({ data: "offline", fromOffline: true });
  });

  it("keeps waiting for the network on timeout when there is no snapshot", async () => {
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: () => new Promise<string>((resolve) => setTimeout(() => resolve("slow-online"), 40)),
      offline: async (): Promise<string | null> => null,
      timeoutMs: 10,
    });
    expect(result).toEqual({ data: "slow-online", fromOffline: false });
  });

  it("serves the snapshot after a browser transport failure", async () => {
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: async (): Promise<string> => {
        throw new TypeError("Failed to fetch");
      },
      offline: async () => "offline",
      timeoutMs: 50,
    });
    expect(result).toEqual({ data: "offline", fromOffline: true });
  });

  it.each([
    { code: "42501", message: "permission denied" },
    { status: 401, message: "expired token" },
    { status: 403, message: "Failed to fetch" },
    { code: "23505", message: "duplicate key" },
    new Error("invalid response"),
    new DOMException("Request cancelled", "AbortError"),
  ])("never substitutes private cached data for a non-transport error: %o", async (error) => {
    const offline = vi.fn(async () => "private cached data");
    await expect(fetchWithOfflineFallback({
      jobId: "job",
      online: async () => { throw error; },
      offline,
    })).rejects.toBe(error);
    expect(offline).not.toHaveBeenCalled();
  });

  it("supports the network error shape returned by PostgREST", async () => {
    const result = await fetchWithOfflineFallback({
      jobId: "job",
      online: async () => { throw { message: "TypeError: Failed to fetch", code: "", details: "" }; },
      offline: async () => "offline",
    });
    expect(result).toEqual({ data: "offline", fromOffline: true });
  });

  it("rethrows the online error when there is no snapshot", async () => {
    await expect(
      fetchWithOfflineFallback({
        jobId: "job",
        online: async () => {
          throw new Error("network down");
        },
        offline: async (): Promise<string | null> => null,
        timeoutMs: 50,
      }),
    ).rejects.toThrow("network down");
  });
});
