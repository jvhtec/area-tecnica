import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBKeyRange, IDBObjectStore } from "fake-indexeddb";
import { capturePrivateDataScope, setPrivateDataIdentity } from "@/lib/private-data-scope";
import { offlineDb, SNAPSHOT_STORE, QUEUE_STORE, FILES_STORE, __resetOfflineDbForTests } from "../offline-db";

describe.each(["memory", "indexeddb"])("private offline account boundary (%s)", (backend) => {
  beforeEach(() => {
    __resetOfflineDbForTests();
    vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
    setPrivateDataIdentity("account-a", "management:sound");
  });
  afterEach(() => {
    setPrivateDataIdentity(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("isolates snapshots, pending changes and files between accounts", async () => {
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job", secret: "A snapshot" });
    await offlineDb.put(QUEUE_STORE, { id: "edit", jobId: "job", secret: "A edit" });
    await offlineDb.put(FILES_STORE, { key: "rider.pdf", jobId: "job", blob: new Blob(["A rider"]) });
    setPrivateDataIdentity("account-b", "management:sound");
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toBeNull();
    expect(await offlineDb.getAll(QUEUE_STORE)).toEqual([]);
    expect(await offlineDb.get(FILES_STORE, "rider.pdf")).toBeNull();
    expect(await offlineDb.getKeysByIndex(FILES_STORE, "jobId", "job")).toEqual([]);
    setPrivateDataIdentity("account-a", "management:sound");
    expect(await offlineDb.get(QUEUE_STORE, "edit")).toMatchObject({ secret: "A edit" });
  });

  it("does not return old privileged snapshots or blobs after a role change", async () => {
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job", secret: "manager snapshot" });
    await offlineDb.put(FILES_STORE, { key: "rider.pdf", jobId: "job", secret: "manager file" });
    await offlineDb.put(QUEUE_STORE, { id: "edit", jobId: "job" });
    setPrivateDataIdentity("account-a", "technician:sound");
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toBeNull();
    expect(await offlineDb.get(FILES_STORE, "rider.pdf")).toBeNull();
    // An author's unsent work is retained, never automatically reassigned.
    expect(await offlineDb.getAll(QUEUE_STORE)).toHaveLength(1);
  });

  it("denies private reads and writes without an identity", async () => {
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job" });
    setPrivateDataIdentity(null);
    await expect(offlineDb.get(SNAPSHOT_STORE, "job")).rejects.toThrow();
    await expect(offlineDb.put(QUEUE_STORE, { id: "edit" })).rejects.toThrow();
  });

  it("invalidates captured work even when the same account logs back in", () => {
    const scope = capturePrivateDataScope();
    setPrivateDataIdentity(null);
    setPrivateDataIdentity("account-a", "management:sound");
    expect(scope.signal.aborted).toBe(true);
    expect(() => scope.assertCurrent()).toThrow();
  });

  if (backend === "indexeddb") {
    it("rejects and rolls back when a transaction aborts after request success", async () => {
      const originalPut = IDBObjectStore.prototype.put;
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
        const request = originalPut.call(this, value, key);
        request.addEventListener("success", () => this.transaction.abort());
        return request;
      });
      await expect(offlineDb.put(QUEUE_STORE, { id: "edit", jobId: "job" })).rejects.toThrow();
      expect(await offlineDb.get(QUEUE_STORE, "edit")).toBeNull();
    });

    it("cancels an uncommitted write if the identity changes after request success", async () => {
      const originalPut = IDBObjectStore.prototype.put;
      vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
        const request = originalPut.call(this, value, key);
        request.addEventListener("success", () => setPrivateDataIdentity("account-b", "management:sound"));
        return request;
      });
      await expect(offlineDb.put(QUEUE_STORE, { id: "edit", jobId: "job" })).rejects.toThrow();
      setPrivateDataIdentity("account-a", "management:sound");
      expect(await offlineDb.get(QUEUE_STORE, "edit")).toBeNull();
    });
  }
});
