import { beforeEach, describe, expect, it, vi } from "vitest";

import { dataLayerClient } from "@/services/dataLayerClient";
import { fetchFlexMotorUnits, type FlexMotorUnit } from "@/services/flexMotorUnits";

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    functions: { invoke: vi.fn() },
  },
}));

const invokeMock = vi.mocked(dataLayerClient.functions.invoke);

const motorUnit: FlexMotorUnit = {
  id: "unit-1",
  modelId: "model-1",
  modelName: "LIFTKET STAR 500 kg",
  manufacturer: "LIFTKET",
  serial: "L5755TC",
  barcode: "53658-01",
  stencil: null,
  modelNumber: null,
  currentLocation: null,
  shippedDate: null,
  returnDate: null,
};

describe("fetchFlexMotorUnits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts the sanitized motor-unit response and filters unknown manifest units", async () => {
    invokeMock.mockResolvedValue({
      data: {
        units: [motorUnit],
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
      units: [motorUnit],
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

  it("normalizes a pre-rollout unit without manufacturer to null", async () => {
    const { manufacturer: _manufacturer, ...malformedUnit } = motorUnit;
    invokeMock.mockResolvedValue({
      data: {
        units: [malformedUnit],
        modelErrors: [],
        manifest: { status: "empty", unitIds: [], sources: [], message: "No hay motores.", warnings: [] },
      },
      error: null,
    } as never);

    await expect(fetchFlexMotorUnits("job-1")).resolves.toEqual({
      units: [{ ...malformedUnit, manufacturer: null }],
      modelErrors: [],
      manifest: {
        status: "empty",
        unitIds: [],
        sources: [],
        message: "No hay motores.",
        warnings: [],
      },
    });
  });

  it("rejects a unit with a malformed manufacturer", async () => {
    invokeMock.mockResolvedValue({
      data: {
        units: [{ ...motorUnit, manufacturer: 42 }],
        modelErrors: [],
        manifest: { status: "empty", unitIds: [], sources: [], message: "No hay motores.", warnings: [] },
      },
      error: null,
    } as never);

    await expect(fetchFlexMotorUnits("job-1")).rejects.toThrow("respuesta no válida");
  });

  it("rejects malformed function responses", async () => {
    invokeMock.mockResolvedValue({ data: null, error: null } as never);
    await expect(fetchFlexMotorUnits("job-1")).rejects.toThrow("respuesta no válida");
  });

  it("rejects malformed nested manifest data", async () => {
    invokeMock.mockResolvedValue({
      data: {
        units: [],
        modelErrors: [],
        manifest: {
          status: "empty",
          sources: [],
          message: "No hay motores.",
          warnings: [],
        },
      },
      error: null,
    } as never);

    await expect(fetchFlexMotorUnits("job-1")).rejects.toThrow("respuesta no válida");
  });
});
