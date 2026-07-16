import { describe, expect, it } from "vitest";

import type { FlexMotorUnit } from "./motorUnits";
import {
  findEquipmentListsInTree,
  matchMotorUnitsInManifest,
  selectOutboundManifest,
} from "./manifestUnits";

const units: FlexMotorUnit[] = [
  {
    id: "unit-1",
    modelId: "model-1",
    modelName: "Motor 500 kg",
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
    modelName: "Motor 500 kg",
    serial: "SERIE-2",
    barcode: "BAR-2",
    stencil: null,
    modelNumber: null,
    currentLocation: null,
    shippedDate: null,
    returnDate: null,
  },
];

describe("Flex job manifest discovery", () => {
  it("finds equipment lists recursively by definition or domain", () => {
    expect(findEquipmentListsInTree({
      children: [
        {
          elementId: "list-1",
          displayName: "Material sonido",
          definitionId: "a220432c-af33-11df-b8d5-00e08175e43e",
        },
        {
          id: "folder-1",
          children: [{ elementId: "list-2", name: "Material luces", domainId: "equipment-list" }],
        },
      ],
    })).toEqual([
      { id: "list-1", name: "Material sonido" },
      { id: "list-2", name: "Material luces" },
    ]);
  });

  it("prefers the shipped manifest and falls back to the prep manifest", () => {
    const list = { id: "list-1", name: "Material" };
    expect(selectOutboundManifest({ prepManifestId: "prep-1", shipManifestId: "ship-1" }, list))
      .toEqual(expect.objectContaining({ manifestId: "ship-1", stage: "ship" }));
    expect(selectOutboundManifest({ prepManifestId: "prep-1" }, list))
      .toEqual(expect.objectContaining({ manifestId: "prep-1", stage: "prep" }));
  });

  it("matches only known motor units by unit id, serial, or barcode", () => {
    expect(matchMotorUnitsInManifest({
      children: [
        { id: "line-1", resourceId: "unit-1", serial: "SERIE-1" },
        { id: "line-2", barcode: "BAR-2" },
        { id: "line-3", serial: "NOT-A-MOTOR" },
      ],
    }, units)).toEqual(["unit-1", "unit-2"]);
  });
});
