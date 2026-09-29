import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, calls, resolveFestivalLogoUrl, resolveTourLogoUrl } = vi.hoisted(() => {
  const state = {
    tables: {} as Record<string, { data: unknown[] | null; error: unknown }>,
    calls: [] as string[],
  };
  return {
    tables: state.tables,
    calls: state.calls,
    resolveFestivalLogoUrl: vi.fn(async (path: string) => `https://cdn/festival/${path}`),
    resolveTourLogoUrl: vi.fn(async (path: string) => `https://cdn/tour/${path}`),
  };
});

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: (table: string) => {
      calls.push(table);
      const result = tables[table] ?? { data: [], error: null };
      const builder = {
        select: () => builder,
        in: () => builder,
        not: () => builder,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    },
  },
}));
vi.mock("@/utils/pdf/logoUtils", () => ({ resolveFestivalLogoUrl, resolveTourLogoUrl }));

import { fetchFestivalListLogoUrls } from "../festivalLogos";

describe("fetchFestivalListLogoUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    for (const key of Object.keys(tables)) delete tables[key];
  });

  it("returns nothing and reads nothing for an empty list", async () => {
    await expect(fetchFestivalListLogoUrls([])).resolves.toEqual({});
    expect(calls).toEqual([]);
  });

  it("uses each festival's own logo and never asks about tours when every festival has one", async () => {
    tables.festival_logos = {
      data: [
        { job_id: "a", file_path: "a.png" },
        { job_id: "b", file_path: "b.png" },
      ],
      error: null,
    };

    const urls = await fetchFestivalListLogoUrls(["a", "b"]);

    expect(urls).toEqual({ a: "https://cdn/festival/a.png", b: "https://cdn/festival/b.png" });
    expect(calls).toEqual(["festival_logos"]);
  });

  it("falls back to the tour logo for festivals without their own, in three queries in total", async () => {
    tables.festival_logos = { data: [{ job_id: "a", file_path: "a.png" }], error: null };
    tables.jobs = {
      data: [
        { id: "b", tour_id: "t1" },
        { id: "c", tour_id: "t1" },
        { id: "d", tour_id: "t2" },
      ],
      error: null,
    };
    tables.tour_logos = { data: [{ tour_id: "t1", file_path: "t1.png" }], error: null };

    const urls = await fetchFestivalListLogoUrls(["a", "b", "c", "d", "e"]);

    expect(urls).toEqual({
      a: "https://cdn/festival/a.png",
      b: "https://cdn/tour/t1.png",
      c: "https://cdn/tour/t1.png",
    });
    expect(calls).toEqual(["festival_logos", "jobs", "tour_logos"]);
  });

  it("omits festivals whose logo cannot be resolved to a URL", async () => {
    tables.festival_logos = { data: [{ job_id: "a", file_path: "broken.png" }], error: null };
    resolveFestivalLogoUrl.mockResolvedValueOnce(undefined as never);

    await expect(fetchFestivalListLogoUrls(["a"])).resolves.toEqual({});
  });

  it("looks each festival up once even if listed twice", async () => {
    tables.festival_logos = { data: [{ job_id: "a", file_path: "a.png" }], error: null };

    await fetchFestivalListLogoUrls(["a", "a"]);

    expect(resolveFestivalLogoUrl).toHaveBeenCalledTimes(1);
  });

  it("surfaces a database error so the caller can report it", async () => {
    tables.festival_logos = { data: null, error: new Error("denied") };

    await expect(fetchFestivalListLogoUrls(["a"])).rejects.toThrow("denied");
  });
});
