import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataLayerClient } from "@/services/dataLayerClient";
import { fetchFlexMotorUnits } from "@/services/flexMotorUnits";

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    functions: { invoke: vi.fn() },
  },
}));

const invokeMock = vi.mocked(dataLayerClient.functions.invoke);

describe("fetchFlexMotorUnits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the sanitized motor-unit response", async () => {
    invokeMock.mockResolvedValue({
      data: {
        units: [{
          id: "unit-1",
          modelId: "model-1",
          modelName: "Motor 500 kg",
          serial: " L5755TC ",
          barcode: "53658-01",
        }],
        modelErrors: [],
        manifest: {
          status: "found",
          unitIds: ["unit-1", "unknown-unit"],
          sources: [{
            equipmentListId: "list-1",
            equipmentListName: "Material sonido",
            manifestId: "manifest-1",
            stage: "ship",
          }],
          message: "1 motor encontrado.",
          warnings: [],
        },
      },
      error: null,
    } as never);

    await expect(fetchFlexMotorUnits("job-1")).resolves.toEqual({
      units: [{
        id: "unit-1",
        modelId: "model-1",
        modelName: "Motor 500 kg",
        serial: "L5755TC",
        barcode: "53658-01",
        stencil: null,
        modelNumber: null,
        currentLocation: null,
        shippedDate: null,
        returnDate: null,
      }],
      modelErrors: [],
      manifest: {
        status: "found",
        unitIds: ["unit-1"],
        sources: [{
          equipmentListId: "list-1",
          equipmentListName: "Material sonido",
          manifestId: "manifest-1",
          stage: "ship",
        }],
        message: "1 motor encontrado.",
        warnings: [],
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("fetch-flex-motor-units", {
      body: { jobId: "job-1" },
    });
  });

  it("rejects malformed function responses", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null } as never);
    await expect(fetchFlexMotorUnits("job-1")).rejects.toThrow("respuesta no válida");
  });
});
