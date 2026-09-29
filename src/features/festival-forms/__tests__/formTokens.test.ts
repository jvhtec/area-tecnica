import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { rpc },
}));

import { getOrCreateArtistFormTokenForSend } from "@/features/festival-forms/formTokens";

describe("getOrCreateArtistFormTokenForSend", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("maps the send-owned token returned by the RPC", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          created: true,
          expires_at: "2031-07-17T12:00:00Z",
          form_id: "form-1",
          token: "token-1",
        },
      ],
      error: null,
    });

    await expect(getOrCreateArtistFormTokenForSend("artist-1")).resolves.toEqual({
      created: true,
      expiresAt: "2031-07-17T12:00:00Z",
      formId: "form-1",
      token: "token-1",
    });
    expect(rpc).toHaveBeenCalledWith("get_or_create_festival_artist_form_for_send", {
      p_artist_id: "artist-1",
    });
  });

  it("surfaces database errors", async () => {
    const error = new Error("forbidden");
    rpc.mockResolvedValue({ data: null, error });

    await expect(getOrCreateArtistFormTokenForSend("artist-1")).rejects.toBe(error);
  });

  it("rejects malformed RPC results", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(getOrCreateArtistFormTokenForSend("artist-1")).rejects.toThrow(
      "did not return a valid token",
    );
  });
});
