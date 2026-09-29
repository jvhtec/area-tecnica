import { beforeEach, describe, expect, it, vi } from "vitest";

const { client, uploadStorageObject } = vi.hoisted(() => {
  const state = {
    inserts: [] as unknown[],
    failInsertAt: -1,
    riderUpdateError: null as unknown,
    deletedIds: [] as string[],
    removedPaths: [] as string[],
  };

  const filesTable = {
    insert: (row: unknown) => {
      const index = state.inserts.length;
      state.inserts.push(row);
      return {
        select: () => ({
          single: async () =>
            index === state.failInsertAt
              ? { data: null, error: new Error("insert failed") }
              : { data: { id: `file-${index}` }, error: null },
        }),
      };
    },
    delete: () => ({
      in: async (_column: string, ids: string[]) => {
        state.deletedIds.push(...ids);
        return { error: null };
      },
    }),
  };

  const artistsTable = {
    update: () => ({ eq: async () => ({ error: state.riderUpdateError }) }),
  };

  return {
    client: {
      state,
      from: (table: string) => (table === "festival_artist_files" ? filesTable : artistsTable),
      storage: {
        from: () => ({
          remove: async (paths: string[]) => {
            state.removedPaths.push(...paths);
            return { error: null };
          },
        }),
      },
    },
    uploadStorageObject: vi.fn(),
  };
});

vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: client }));
vi.mock("@/utils/storageUpload", () => ({
  uploadStorageObject,
  getStorageUploadErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "upload error"),
}));
vi.mock("@/utils/imageOptimization", () => ({
  optimizeImageForUpload: async (file: File) => file,
}));

import { uploadArtistFiles } from "../api";

const pdf = (name: string) => new File(["x"], name, { type: "application/pdf" });

describe("uploadArtistFiles", () => {
  beforeEach(() => {
    client.state.inserts = [];
    client.state.failInsertAt = -1;
    client.state.riderUpdateError = null;
    client.state.deletedIds = [];
    client.state.removedPaths = [];
    uploadStorageObject.mockReset();
    uploadStorageObject.mockResolvedValue(undefined);
  });

  it("stores every file under the artist and marks the rider as received", async () => {
    const result = await uploadArtistFiles("artist-1", [pdf("a.pdf"), pdf("b.pdf")]);

    expect(result).toEqual({ riderStateUpdated: true });
    expect(uploadStorageObject).toHaveBeenCalledTimes(2);
    expect(client.state.inserts).toHaveLength(2);
    expect(client.state.inserts[0]).toMatchObject({ artist_id: "artist-1", file_name: "a.pdf", file_type: "application/pdf" });
    expect(client.state.removedPaths).toEqual([]);
  });

  it("keeps the files but reports it when the rider flags could not be updated", async () => {
    client.state.riderUpdateError = new Error("denied");
    await expect(uploadArtistFiles("artist-1", [pdf("a.pdf")])).resolves.toEqual({ riderStateUpdated: false });
    expect(client.state.removedPaths).toEqual([]);
  });

  it("rolls the whole batch back when a later file fails", async () => {
    client.state.failInsertAt = 1;

    await expect(uploadArtistFiles("artist-1", [pdf("a.pdf"), pdf("b.pdf")])).rejects.toThrow("insert failed");

    // The first file's record and both stored objects (the failed one already uploaded) are removed.
    expect(client.state.deletedIds).toEqual(["file-0"]);
    expect(client.state.removedPaths).toHaveLength(2);
  });

  it("removes what was stored when a storage upload fails", async () => {
    uploadStorageObject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("quota exceeded"));

    await expect(uploadArtistFiles("artist-1", [pdf("a.pdf"), pdf("b.pdf")])).rejects.toThrow("quota exceeded");

    expect(client.state.deletedIds).toEqual(["file-0"]);
    expect(client.state.removedPaths).toHaveLength(1);
  });
});
