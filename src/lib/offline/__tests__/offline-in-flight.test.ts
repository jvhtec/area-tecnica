import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { setPrivateDataIdentity } from "@/lib/private-data-scope";
import { __resetOfflineDbForTests, offlineDb, QUEUE_STORE, SNAPSHOT_STORE } from "@/lib/offline/offline-db";
import { downloadFestivalSnapshot } from "@/lib/offline/festival-snapshot";
import { downloadFestivalFiles, getOfflineFileBlob } from "@/lib/offline/festival-files";
import { getPendingChanges, queueFestivalChange } from "@/lib/offline/festival-offline-queue";
import { syncFestivalPendingChanges } from "@/lib/offline/festival-sync";
import { __resetOfflineRevocationsForTests } from "@/lib/offline/offline-revocation";

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));
vi.mock("@/lib/private-supabase-client", () => ({ createPrivateSupabaseClient: vi.fn(async () => mockSupabase) }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("offline operations during an account change", () => {
  beforeEach(() => {
    __resetOfflineDbForTests();
    __resetOfflineRevocationsForTests();
    resetMockSupabase();
    mockSupabase.rpc.mockResolvedValue({ data: "management", error: null });
    setPrivateDataIdentity("account-a", "management:sound");
  });
  afterEach(() => setPrivateDataIdentity(null));

  it("does not save a snapshot whose first response arrives after logout", async () => {
    const response = deferred<{ data: { id: string }; error: null }>();
    const builder = createMockQueryBuilder();
    builder.single.mockReturnValue(response.promise);
    mockSupabase.from.mockReturnValue(builder);
    const download = downloadFestivalSnapshot("job");
    await vi.waitFor(() => expect(builder.single).toHaveBeenCalled());
    setPrivateDataIdentity("account-b", "management:sound");
    response.resolve({ data: { id: "job" }, error: null });
    await expect(download).rejects.toThrow();
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toBeNull();
    setPrivateDataIdentity("account-a", "management:sound");
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toBeNull();
  });

  it("refuses to rebuild a revoked snapshot from RLS-filtered empty rows", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: "technician", error: null });
    mockSupabase.from.mockReturnValue(createMockQueryBuilder({ data: [], error: null }));
    await offlineDb.put(SNAPSHOT_STORE, { jobId: "job", secret: "old snapshot" });
    await offlineDb.put(QUEUE_STORE, { id: "unsent", jobId: "job" });
    await expect(downloadFestivalSnapshot("job")).rejects.toMatchObject({ code: "42501" });
    expect(mockSupabase.from).toHaveBeenCalledWith("job_assignments");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("jobs");
    expect(await offlineDb.get(SNAPSHOT_STORE, "job")).toMatchObject({ accessRevoked: true });
    expect(await getPendingChanges("job")).toHaveLength(1);
  });

  it("does not write a late file into the next account or start another worker request", async () => {
    const response = deferred<{ data: Blob; error: null }>();
    const downloadMock = vi.fn(() => response.promise);
    mockSupabase.storage.from.mockReturnValue({ download: downloadMock } as never);
    const refs = Array.from({ length: 5 }, (_, i) => ({ bucket: "riders", path: `${i}.pdf`, fileName: `${i}.pdf` }));
    const download = downloadFestivalFiles("job", refs);
    await vi.waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(4));
    setPrivateDataIdentity("account-b", "management:sound");
    response.resolve({ data: new Blob(["account A private document"]), error: null });
    await expect(download).rejects.toThrow();
    expect(downloadMock).toHaveBeenCalledTimes(4);
    expect(await getOfflineFileBlob("riders", "0.pdf")).toBeNull();
    setPrivateDataIdentity("account-a", "management:sound");
    expect(await getOfflineFileBlob("riders", "0.pdf")).toBeNull();
  });

  it("does not reassign queued work waiting for its local write lock", async () => {
    const queued = queueFestivalChange({ jobId: "job", table: "festival_artists", operation: "insert", recordId: "artist" });
    setPrivateDataIdentity("account-b", "management:sound");
    await expect(queued).rejects.toThrow();
    expect(await getPendingChanges("job")).toEqual([]);
  });

  it("stops syncing after an account change and retains unacknowledged work for its author", async () => {
    for (const id of ["one", "two"]) {
      await offlineDb.put(QUEUE_STORE, {
        id, jobId: "job", table: "festival_artists", operation: "insert", recordId: id,
        payload: { job_id: "job", name: id }, createdAt: id, baseUpdatedAt: null,
      });
    }
    const response = deferred<{ error: null }>();
    const builder = createMockQueryBuilder();
    builder.insert.mockReturnValue(response.promise);
    mockSupabase.from.mockReturnValue(builder);
    const sync = syncFestivalPendingChanges("job", { skipSnapshotRefresh: true });
    await vi.waitFor(() => expect(builder.insert).toHaveBeenCalledTimes(1));
    setPrivateDataIdentity("account-b", "management:sound");
    response.resolve({ error: null });
    await expect(sync).rejects.toThrow();
    expect(builder.insert).toHaveBeenCalledTimes(1);
    expect(await getPendingChanges()).toEqual([]);
    setPrivateDataIdentity("account-a", "management:sound");
    expect(await getPendingChanges()).toHaveLength(2);
  });

  it("removes a cached private file when the server denies its re-download", async () => {
    const downloadMock = vi.fn().mockResolvedValue({ data: new Blob(["old rider"]), error: null });
    mockSupabase.storage.from.mockReturnValue({ download: downloadMock } as never);
    const refs = [{ bucket: "riders", path: "one.pdf", fileName: "one.pdf" }];
    await downloadFestivalFiles("job", refs);
    expect(await getOfflineFileBlob("riders", "one.pdf")).not.toBeNull();
    downloadMock.mockResolvedValue({ data: null, error: { status: 403, message: "Forbidden" } });
    expect(await downloadFestivalFiles("job", refs)).toMatchObject({ failed: 1 });
    expect(await getOfflineFileBlob("riders", "one.pdf")).toBeNull();
  });
});
