import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  previousPath: null as string | null,
  removed: [] as string[][],
  cacheDelete: vi.fn(),
}));

vi.mock("@/lib/logo-url-cache", () => ({ logoUrlCache: { delete: mocks.cacheDelete } }));
vi.mock("@/utils/imageOptimization", () => ({
  optimizeImageForUpload: vi.fn(async (file: File) => new File([file], "logo.webp", { type: "image/webp" })),
}));
vi.mock("@/utils/storageUpload", () => ({ getStorageUploadErrorMessage: vi.fn(), uploadStorageObject: vi.fn() }));
vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    auth: { getSession: async () => ({ data: { session: {} }, error: null }) },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          mocks.removed.push(paths);
          return { error: null };
        },
        upload: async () => ({ error: null }),
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed/${path}` } }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://public/${path}` } }),
      }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.previousPath ? { file_path: mocks.previousPath } : null, error: null }) }) }),
      upsert: async () => ({ error: null }),
    }),
  },
}));

import { uploadFestivalLogo } from "../api";

const image = new File(["x"], "logo.png", { type: "image/png" });

describe("uploadFestivalLogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.removed.length = 0;
    mocks.previousPath = null;
  });

  it("forgets the cached URL of the path it wrote, so a replacement shows on the festival list", async () => {
    mocks.previousPath = "job-1.webp";

    const url = await uploadFestivalLogo({ jobId: "job-1", file: image, userId: "u" });

    expect(url).toBe("https://signed/job-1.webp");
    expect(mocks.cacheDelete).toHaveBeenCalledWith("festival-logos", "job-1.webp");
  });

  it("also forgets the previous file's URL when the extension changed", async () => {
    mocks.previousPath = "job-1.png";

    await uploadFestivalLogo({ jobId: "job-1", file: image, userId: "u" });

    expect(mocks.cacheDelete).toHaveBeenCalledWith("festival-logos", "job-1.png");
    expect(mocks.cacheDelete).toHaveBeenCalledWith("festival-logos", "job-1.webp");
  });
});
