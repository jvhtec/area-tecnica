import { describe, expect, it } from "vitest";

import { discoverEstructuraManifestSelection } from "./estructuraManifestSelection.ts";
import type { FlexMotorUnit } from "./motorUnits.ts";

const units: FlexMotorUnit[] = [
  {
    id: "unit-1",
    modelId: "model-1",
    modelName: "Motor 1T",
    manufacturer: null,
    serial: "SERIE-1",
    barcode: "BAR-1",
    stencil: null,
    modelNumber: null,
    currentLocation: null,
    shippedDate: null,
    returnDate: null,
  },
  {
    id: "unit-2",
    modelId: "model-1",
    modelName: "Motor 1T",
    manufacturer: null,
    serial: "SERIE-2",
    barcode: "BAR-2",
    stencil: null,
    modelNumber: null,
    currentLocation: null,
    shippedDate: null,
    returnDate: null,
  },
];

const lists = [
  { id: "sound-ps", name: "Estructura Sonido" },
  { id: "lights-ps", name: "Estructura Luces" },
];

describe("discoverEstructuraManifestSelection", () => {
  it("merges both Estructura manifests and deduplicates serialized units", async () => {
    const result = await discoverEstructuraManifestSelection({
      trackedEquipmentLists: lists,
      missingSourceDepartments: [],
      units,
      concurrency: 2,
      fetchWarehouseState: async (id) => id === "sound-ps"
        ? { shipManifestId: "sound-manifest" }
        : { prepManifestId: "lights-manifest" },
      fetchManifestRows: async (id) => id === "sound-manifest"
        ? [{ resourceId: "unit-1" }, { resourceId: "unit-2" }]
        : [{ serial: "SERIE-2" }],
    });

    expect(result.status).toBe("found");
    expect(result.unitIds).toEqual(["unit-1", "unit-2"]);
    expect(result.sources).toHaveLength(2);
  });

  it("uses the readable side and warns when the other Pull Sheet fails", async () => {
    const result = await discoverEstructuraManifestSelection({
      trackedEquipmentLists: lists,
      missingSourceDepartments: [],
      units,
      concurrency: 2,
      fetchWarehouseState: async (id) => {
        if (id === "lights-ps") throw new Error("Flex unavailable");
        return { shipManifestId: "sound-manifest" };
      },
      fetchManifestRows: async () => [{ resourceId: "unit-1" }],
    });

    expect(result.status).toBe("found");
    expect(result.unitIds).toEqual(["unit-1"]);
    expect(result.warnings).toContain("No se han podido consultar 1 Pull Sheets de Estructura en Flex.");
  });

  it("reports an error when both Estructura Pull Sheets fail", async () => {
    const result = await discoverEstructuraManifestSelection({
      trackedEquipmentLists: lists,
      missingSourceDepartments: [],
      units,
      concurrency: 2,
      fetchWarehouseState: async () => {
        throw new Error("Flex unavailable");
      },
      fetchManifestRows: async () => [],
    });

    expect(result.status).toBe("error");
    expect(result.unitIds).toEqual([]);
    expect(result.warnings).toContain("No se han podido consultar 2 Pull Sheets de Estructura en Flex.");
  });

  it("reports unavailable when no tracked Estructura Pull Sheet exists", async () => {
    const result = await discoverEstructuraManifestSelection({
      trackedEquipmentLists: [],
      missingSourceDepartments: ["Sonido", "Luces"],
      units,
      concurrency: 2,
      fetchWarehouseState: async () => ({}),
      fetchManifestRows: async () => [],
    });

    expect(result.status).toBe("unavailable");
    expect(result.unitIds).toEqual([]);
  });

  it("reports empty when manifests exist without approved motors", async () => {
    const result = await discoverEstructuraManifestSelection({
      trackedEquipmentLists: lists,
      missingSourceDepartments: [],
      units,
      concurrency: 2,
      fetchWarehouseState: async (id) => ({ shipManifestId: `${id}-manifest` }),
      fetchManifestRows: async () => [{ resourceId: "not-an-approved-motor" }],
    });

    expect(result.status).toBe("empty");
    expect(result.unitIds).toEqual([]);
  });
});
