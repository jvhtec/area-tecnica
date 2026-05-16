// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  downloadJobDocument,
  downloadRider,
  downloadTourDocument,
  openJobDocument,
  openRider,
  openTourDocument,
} from "../documentActions";

const createStorageClient = () => {
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/doc.pdf" }, error: null });
  const download = vi.fn().mockResolvedValue({ data: new Blob(["file"]), error: null });
  const from = vi.fn().mockReturnValue({ createSignedUrl, download });

  return {
    client: { storage: { from } },
    createSignedUrl,
    download,
    from,
  };
};

describe("technician details modal document actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!window.URL.createObjectURL) {
      Object.defineProperty(window.URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
    }
    if (!window.URL.revokeObjectURL) {
      Object.defineProperty(window.URL, "revokeObjectURL", {
        configurable: true,
        value: vi.fn(),
      });
    }
    vi.spyOn(window, "open").mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:download");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("opens job documents through the resolved job document bucket", async () => {
    const storage = createStorageClient();

    await openJobDocument(storage.client as unknown as SupabaseClient, {
      id: "doc-1",
      file_name: "Plan.pdf",
      file_path: "sound/Plan.pdf",
      uploaded_at: "2026-01-01T00:00:00Z",
      visible_to_tech: true,
    });

    expect(storage.from).toHaveBeenCalledWith("job_documents");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("sound/Plan.pdf", 60);
    expect(window.open).toHaveBeenCalledWith("https://signed.example/doc.pdf", "_blank");
  });

  it("downloads job documents with the original file name", async () => {
    const storage = createStorageClient();

    await downloadJobDocument(storage.client as unknown as SupabaseClient, {
      id: "doc-1",
      file_name: "Plan.pdf",
      file_path: "sound/Plan.pdf",
      uploaded_at: "2026-01-01T00:00:00Z",
      visible_to_tech: true,
    });

    expect(storage.from).toHaveBeenCalledWith("job_documents");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("uses the tour document bucket for tour document open and download actions", async () => {
    const storage = createStorageClient();
    const doc = {
      id: "tour-doc-1",
      tour_id: "tour-1",
      file_name: "Tour.pdf",
      file_path: "tour/Tour.pdf",
      uploaded_at: "2026-01-01T00:00:00Z",
      file_type: "application/pdf",
    };

    await openTourDocument(storage.client as unknown as SupabaseClient, doc);
    await downloadTourDocument(storage.client as unknown as SupabaseClient, doc);

    expect(storage.from).toHaveBeenCalledWith("tour-documents");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("tour/Tour.pdf", 60);
    expect(window.open).toHaveBeenCalledWith("https://signed.example/doc.pdf", "_blank");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("uses festival artist storage for rider open and download actions", async () => {
    const storage = createStorageClient();
    const rider = {
      id: "rider-1",
      file_name: "Rider.pdf",
      file_path: "artist/Rider.pdf",
      uploaded_at: "2026-01-01T00:00:00Z",
      artist_id: "artist-1",
    };

    await openRider(storage.client as unknown as SupabaseClient, rider);
    await downloadRider(storage.client as unknown as SupabaseClient, rider);

    expect(storage.from).toHaveBeenCalledWith("festival_artist_files");
    expect(storage.createSignedUrl).toHaveBeenCalledWith("artist/Rider.pdf", 60);
    expect(storage.download).toHaveBeenCalledWith("artist/Rider.pdf");
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:download");
  });
});
