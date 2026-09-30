import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  resolveFestivalLogoUrl: vi.fn(),
  resolveTourLogoUrl: vi.fn(),
  getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://public/never-used" } })),
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: mocks.tables[table] ?? null, error: null }),
      };
      return builder;
    },
    storage: { from: () => ({ getPublicUrl: mocks.getPublicUrl }) },
  },
}));
vi.mock("@/utils/pdf/logoUtils", () => ({
  resolveFestivalLogoUrl: mocks.resolveFestivalLogoUrl,
  resolveTourLogoUrl: mocks.resolveTourLogoUrl,
}));

import { fetchFestivalLogoUrl } from "../api";

describe("fetchFestivalLogoUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mocks.tables)) delete mocks.tables[key];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a signed URL for the festival's own logo (the bucket is private)", async () => {
    mocks.tables.festival_logos = { file_path: "job-1.webp" };
    mocks.resolveFestivalLogoUrl.mockResolvedValue("https://signed/job-1.webp?token=x");

    await expect(fetchFestivalLogoUrl("job-1")).resolves.toBe("https://signed/job-1.webp?token=x");

    expect(mocks.resolveFestivalLogoUrl).toHaveBeenCalledWith("job-1.webp");
    expect(mocks.getPublicUrl).not.toHaveBeenCalled();
  });

  it("falls back to the tour's logo, signed too, when the festival's file is unreachable", async () => {
    mocks.tables.festival_logos = { file_path: "job-1.webp" };
    mocks.tables.jobs = { tour_id: "tour-1" };
    mocks.tables.tour_logos = { file_path: "tour-1.png" };
    mocks.resolveFestivalLogoUrl.mockResolvedValue("https://signed/festival");
    mocks.resolveTourLogoUrl.mockResolvedValue("https://signed/tour");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: url === "https://signed/tour" })));

    await expect(fetchFestivalLogoUrl("job-1")).resolves.toBe("https://signed/tour");
  });

  it("returns null when nothing is reachable", async () => {
    mocks.tables.festival_logos = { file_path: "job-1.webp" };
    mocks.resolveFestivalLogoUrl.mockResolvedValue("https://signed/festival");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    await expect(fetchFestivalLogoUrl("job-1")).resolves.toBeNull();
  });

  it("returns null without a logo record or a tour", async () => {
    await expect(fetchFestivalLogoUrl("job-1")).resolves.toBeNull();
  });
});
