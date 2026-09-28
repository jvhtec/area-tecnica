import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { rpc, from },
}));

import { deleteAccommodation, saveAccommodation } from "@/features/tour-ops/tourSchedulingMutations";

describe("tour ops accommodation mutations", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    from.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    });
  });

  it("saves a legacy hotel-info hotel as a new normalized hotel linked to its Hoja", async () => {
    rpc.mockResolvedValue({ data: { id: "acc-1", ops_id: "acc-1", hoja_row_id: "ha-1" }, error: null });

    const result = await saveAccommodation({
      id: "hotel-info:hdr-1:0",
      source: "hoja",
      tourId: "tour-1",
      tourDateId: "date-1",
      hojaDeRutaId: "hdr-1",
      hotelName: "Hotel Legacy",
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-02",
      updatedAt: "2026-05-01T00:00:00Z",
      expectedHojaVersions: { "hdr-1": 3 },
    });

    expect(rpc).toHaveBeenCalledWith(
      "save_tour_ops_accommodation",
      expect.objectContaining({
        p_source: "normalized",
        p_accommodation_id: null,
        p_hoja_id: "hdr-1",
        p_hoja_row_id: null,
        p_expected_ops_updated_at: null,
        p_expected_hoja_versions: { "hdr-1": 3 },
      }),
    );
    expect(result).toMatchObject({ id: "acc-1", hojaFinalSkipped: false });
  });

  it("reports when a final Hoja was left untouched", async () => {
    rpc.mockResolvedValue({
      data: { deleted: true, hoja_status: "final", approval_invalidated: false, hoja_final_skipped: true },
      error: null,
    });

    const result = await deleteAccommodation({ id: "acc-1", source: "normalized", hojaDeRutaId: "hdr-1" });

    expect(result).toMatchObject({ hojaStatus: "final", approvalInvalidated: false, hojaFinalSkipped: true });
  });
});
