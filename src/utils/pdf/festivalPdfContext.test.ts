import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadStagePlotUrls } from "@/utils/pdf/festivalPdfContext";

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

vi.mock("@/utils/pdf/logoUtils", () => ({
  fetchJobLogo: vi.fn(),
  fetchLogoUrl: vi.fn(),
}));

describe("loadStagePlotUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({ createSignedUrl: mocks.createSignedUrl });
  });

  it("bounds signing requests while preserving successful URLs and per-artist failures", async () => {
    let activeRequests = 0;
    let peakRequests = 0;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mocks.createSignedUrl.mockImplementation(async (path: string) => {
      activeRequests += 1;
      peakRequests = Math.max(peakRequests, activeRequests);
      await Promise.resolve();
      activeRequests -= 1;

      if (path === "plots/broken.pdf") throw new Error("signing failed");
      return { data: { signedUrl: `https://signed.example/${path}` }, error: null };
    });

    const result = await loadStagePlotUrls([
      { id: "artist-1", stage_plot_file_path: "plots/one.pdf" },
      { id: "artist-2", stage_plot_file_path: "plots/two.pdf" },
      { id: "artist-3", stage_plot_file_path: "plots/broken.pdf" },
      { id: "artist-4", stage_plot_file_path: null },
      { id: "artist-5", stage_plot_file_path: "plots/five.pdf" },
    ], 2);

    expect(peakRequests).toBe(2);
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      "artist-1": "https://signed.example/plots/one.pdf",
      "artist-2": "https://signed.example/plots/two.pdf",
      "artist-5": "https://signed.example/plots/five.pdf",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Error signing stage plot for artist artist-3:",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});
