import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

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
        ? { data: null, error: new Error("storage error") }
        : { data: new Blob([`contenido de ${path}`]), error: null },
    ),
    upload: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn(),
  }));
};

describe("festival offline files", () => {
  beforeEach(() => {
    __resetOfflineDbForTests();
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

  it("removes every cached file of a festival", async () => {
    mockStorageDownload();

    await downloadFestivalFiles(JOB_ID, [
      { bucket: "festival_artist_files", path: "riders/a.pdf", fileName: "a.pdf" },
    ]);
    await deleteOfflineFilesForJob(JOB_ID);

    expect(await getOfflineFileBlob("festival_artist_files", "riders/a.pdf")).toBeNull();
  });
});
