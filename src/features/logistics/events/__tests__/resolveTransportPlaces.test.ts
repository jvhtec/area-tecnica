import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: { from: vi.fn() },
}));

import { resolveTransportPlaces } from "../resolveTransportPlaces";

const field = (input: string, resolved: string | null) => ({
  input,
  resolve: vi.fn().mockResolvedValue(resolved),
});

describe("resolveTransportPlaces", () => {
  it("rejects typed destination text that was never selected", async () => {
    const result = await resolveTransportPlaces({
      isCrewTransfer: false,
      selectedJob: null,
      jobs: [],
      location: field("Hotel inventado", null),
      origin: field("", null),
    });
    expect(result).toEqual({
      ok: false,
      message: "Selecciona el destino de la lista para guardar una ubicación válida.",
    });
  });

  it("rejects an unselected crew pick-up point", async () => {
    const result = await resolveTransportPlaces({
      isCrewTransfer: true,
      selectedJob: "job-1",
      jobs: [{ id: "job-1", title: "Gira", location_id: "venue" }],
      location: field("", null),
      origin: field("Nave escrita a mano", null),
    });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("punto de encuentro") });
  });

  it("uses the job venue as the effective destination and refuses the same origin", async () => {
    const result = await resolveTransportPlaces({
      isCrewTransfer: true,
      selectedJob: "job-1",
      jobs: [{ id: "job-1", title: "Gira", location_id: "venue" }],
      location: field("", null),
      origin: field("Recinto", "venue"),
    });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("mismo lugar") });
  });

  it("keeps a selected destination and returns the linked job title for a return leg", async () => {
    const result = await resolveTransportPlaces({
      isCrewTransfer: true,
      selectedJob: "job-1",
      jobs: [{ id: "job-1", title: "Gira", location_id: "venue" }],
      location: field("Hotel", "hotel"),
      origin: field("Nave", "warehouse"),
    });
    expect(result).toEqual({
      ok: true,
      locationId: "hotel",
      originId: "warehouse",
      effectiveDestinationId: "hotel",
      jobTitle: "Gira",
    });
  });
});
