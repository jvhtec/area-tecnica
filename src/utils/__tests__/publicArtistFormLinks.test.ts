import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  query.select = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gt = vi.fn(() => query);
  query.order = vi.fn();

  return {
    from: vi.fn(() => query),
    query,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

import { getActivePublicArtistFormLinks } from "@/utils/publicArtistFormLinks";

describe("getActivePublicArtistFormLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.order.mockResolvedValue({ data: [], error: null });
  });

  it("returns only tokens already issued by an explicit send action", async () => {
    mocks.query.order.mockResolvedValue({
      data: [
        {
          artist_id: "artist-1",
          expires_at: "2031-07-17T12:00:00Z",
          token: "sent-token",
        },
      ],
      error: null,
    });

    await expect(
      getActivePublicArtistFormLinks([
        { id: "artist-1", form_language: "en" },
        { id: "artist-without-send", form_language: "es" },
      ]),
    ).resolves.toEqual({
      "artist-1":
        "https://sector-pro.work/festival/artist-form/sent-token?lang=en",
    });

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("festival_artist_forms");
    expect(mocks.query.eq).toHaveBeenCalledWith("status", "pending");
    expect(mocks.query.gt).toHaveBeenCalledWith(
      "expires_at",
      expect.any(String),
    );
    expect(mocks.query).not.toHaveProperty("insert");
  });

  it("does not query when there are no artists", async () => {
    await expect(getActivePublicArtistFormLinks([])).resolves.toEqual({});
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces read failures without attempting token creation", async () => {
    const error = new Error("read failed");
    mocks.query.order.mockResolvedValue({ data: null, error });

    await expect(
      getActivePublicArtistFormLinks([{ id: "artist-1" }]),
    ).rejects.toBe(error);
  });
});
