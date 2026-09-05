import { setPrivateDataIdentity } from "@/lib/private-data-scope";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/lib/private-supabase-client", () => ({ createPrivateSupabaseClient: vi.fn(async () => mockSupabase) }));

import { __resetOfflineDbForTests } from "../offline-db";
import {
  deleteOfflineFilesForJob,
  downloadFestivalFiles,
  getOfflineFileBlob,
} from "../festival-files";

const JOB_ID = "job-1";

const mockStorageDownload = (failPaths: string[] = []) => {
  mockSupabase.storage.from.mockImplementation(() => ({
    download: vi.fn(async (path: string) =>
      failPaths.includes(path)
        ? { data: null, error: new TypeError("Failed to fetch") }
        : { data: new Blob([`contenido de ${path}`]), error: null },
    ),
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn(),
  }));
};

describe("festival offline files", () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(() => {
    __resetOfflineDbForTests();
    setPrivateDataIdentity("account-a", "management:sound");
    resetMockSupabase();
  });

  it("downloads and stores the referenced files", async () => {
    mockStorageDownload();

    const stats = await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/a.pdf", fileName: "a.pdf" },
      { bucket: "job-documents", path: "docs/b.pdf", fileName: "b.pdf" },
    ]);

    expect(stats).toEqual({ total: 2, downloaded: 2, failed: 0 });
    expect(await getOfflineFileBlob("festival_artist_files", "riders/a.pdf")).not.toBeNull();
    expect(await getOfflineFileBlob("job-documents", "docs/b.pdf")).not.toBeNull();
  });

  it("counts failures without aborting the rest of the batch", async () => {
    mockStorageDownload(["riders/broken.pdf"]);

    const stats = await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/broken.pdf", fileName: "broken.pdf" },
      { bucket: "festival_artist_files", path: "riders/ok.pdf", fileName: "ok.pdf" },
    ]);

    expect(stats).toEqual({ total: 2, downloaded: 1, failed: 1 });
    expect(await getOfflineFileBlob("festival_artist_files", "riders/ok.pdf")).not.toBeNull();
    expect(await getOfflineFileBlob("festival_artist_files", "riders/broken.pdf")).toBeNull();
  });

  it("keeps a previously cached file when a re-download fails", async () => {
    mockStorageDownload();
    await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/a.pdf", fileName: "a.pdf" },
    ]);

    mockStorageDownload(["riders/a.pdf"]);
    const stats = await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/a.pdf", fileName: "a.pdf" },
    ]);

    expect(stats).toEqual({ total: 1, downloaded: 0, failed: 1 });
    expect(await getOfflineFileBlob("festival_artist_files", "riders/a.pdf")).not.toBeNull();
  });

  it("prunes files that no longer belong to the festival on refresh", async () => {
    mockStorageDownload();

    await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/old.pdf", fileName: "old.pdf" },
    ]);
    await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/new.pdf", fileName: "new.pdf" },
    ]);

    expect(await getOfflineFileBlob("festival_artist_files", "riders/old.pdf")).toBeNull();
    expect(await getOfflineFileBlob("festival_artist_files", "riders/new.pdf")).not.toBeNull();
  });

  it("retains a cached rider after Storage wraps the download's own timeout", async () => {
    const refs = [{ bucket: "riders", path: "a.pdf", fileName: "a.pdf" }];
    mockStorageDownload();
    await downloadFestivalFiles(JOB_ID, refs);
    vi.useFakeTimers();
    const download = vi.fn((_path, _options, { signal }: { signal: AbortSignal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => resolve({
        data: null, error: { name: "StorageUnknownError", message: "This operation was aborted", originalError: new DOMException("Aborted", "AbortError") },
      }), { once: true });
    }));
    mockSupabase.storage.from.mockReturnValue({ download } as never);
    const refresh = downloadFestivalFiles(JOB_ID, refs);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await refresh).toEqual({ total: 1, downloaded: 0, failed: 1 });
    expect(await getOfflineFileBlob("riders", "a.pdf")).not.toBeNull();
  });

  it.each([403, 404])("removes cached files after a real HTTP %i response", async (status) => {
    const refs = [{ bucket: "riders", path: "a.pdf", fileName: "a.pdf" }];
    mockStorageDownload();
    await downloadFestivalFiles(JOB_ID, refs);
    mockSupabase.storage.from.mockReturnValue({ download: vi.fn(async () => ({
      data: null, error: { status, message: "Unavailable" },
    })) } as never);
    await downloadFestivalFiles(JOB_ID, refs);
    expect(await getOfflineFileBlob("riders", "a.pdf")).toBeNull();
  });

  it("removes every cached file of a festival", async () => {
    mockStorageDownload();

    await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/a.pdf", fileName: "a.pdf" },
    ]);
    await deleteOfflineFilesForJob(JOB_ID);

    expect(await getOfflineFileBlob("festival_artist_files", "riders/a.pdf")).toBeNull();
  });
});
