import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { functions: { invoke: invokeMock } },
}));

import { getPublicArtistRiderSignedUrl } from "@/utils/publicArtistRiderUpload";

describe("getPublicArtistRiderSignedUrl", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("asks the token-validated Edge Function to sign the rider", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, signed_url: "https://signed.example/a.pdf" }, error: null });

    await expect(getPublicArtistRiderSignedUrl("token-1", "file-1", { download: true })).resolves.toBe(
      "https://signed.example/a.pdf",
    );
    expect(invokeMock).toHaveBeenCalledWith("upload-public-artist-rider", {
      body: { action: "sign", token: "token-1", file_id: "file-1", download: true },
    });
  });

  it("defaults to a view (non-download) URL", async () => {
    invokeMock.mockResolvedValue({ data: { ok: true, signed_url: "https://signed.example/a.pdf" }, error: null });

    await getPublicArtistRiderSignedUrl("token-1", "file-1");

    expect(invokeMock).toHaveBeenCalledWith("upload-public-artist-rider", {
      body: { action: "sign", token: "token-1", file_id: "file-1", download: false },
    });
  });

  it("surfaces the function's error code", async () => {
    invokeMock.mockResolvedValue({ data: { ok: false, error: "file_not_found" }, error: null });

    await expect(getPublicArtistRiderSignedUrl("token-1", "file-2")).rejects.toThrow("file_not_found");
  });

  it("rethrows transport errors", async () => {
    const failure = new Error("network");
    invokeMock.mockResolvedValue({ data: null, error: failure });

    await expect(getPublicArtistRiderSignedUrl("token-1", "file-1")).rejects.toBe(failure);
  });
});
