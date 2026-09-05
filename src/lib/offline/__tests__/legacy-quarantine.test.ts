import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { getLegacyQueueStatus } from "../legacy-quarantine";
import { offlineDb, QUEUE_STORE, __resetOfflineDbForTests } from "../offline-db";
import { setPrivateDataIdentity } from "@/lib/private-data-scope";

describe("legacy offline edits remain quarantined", () => {
  beforeEach(() => { __resetOfflineDbForTests(); vi.stubGlobal("indexedDB", new IDBFactory()); });
  afterEach(() => { setPrivateDataIdentity(null); vi.unstubAllGlobals(); });

  it("does not create a database when no legacy data exists", async () => {
    expect(await getLegacyQueueStatus()).toEqual({ status: "none" });
    expect(await indexedDB.databases()).toEqual([]);
  });

  it("retains unknown-author edits without exposing or replaying their payload", async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("sector-pro-offline", 3);
      request.onupgradeneeded = () => request.result.createObjectStore(QUEUE_STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = legacy.transaction(QUEUE_STORE, "readwrite");
      tx.objectStore(QUEUE_STORE).put({ id: "unknown-edit", payload: "private legacy edit" });
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    expect(await getLegacyQueueStatus()).toEqual({ status: "retained", count: 1 });
    for (const user of ["account-a", "account-b"]) {
      setPrivateDataIdentity(user, "management:sound");
      expect(await offlineDb.getAll(QUEUE_STORE)).toEqual([]);
    }
    const row = await new Promise((resolve) => {
      const request = legacy.transaction(QUEUE_STORE).objectStore(QUEUE_STORE).get("unknown-edit");
      request.onsuccess = () => resolve(request.result);
    });
    expect(row).toEqual({ id: "unknown-edit", payload: "private legacy edit" });
    legacy.close();
  });
});
