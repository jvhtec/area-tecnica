import { describe, expect, it } from "vitest";

import {
  MOTOR_MODELS,
  normalizeMotorUnit,
  parseMotorGridPage,
} from "./motorUnits";

describe("Flex motor unit normalization", () => {
  it("keeps only the read-only fields required by the certificate selector", () => {
    const unit = normalizeMotorUnit({
      id: "unit-1",
      serial: " J36717 ",
      barcode: "04113-01",
      currentLocation: { preferredDisplayString: "Almacén" },
      purchaseCost: 9999,
    }, MOTOR_MODELS[0]);

    expect(unit).toEqual({
      id: "unit-1",
      modelId: MOTOR_MODELS[0].id,
      modelName: MOTOR_MODELS[0].name,
      serial: "J36717",
      barcode: "04113-01",
      stencil: null,
      modelNumber: null,
      currentLocation: "Almacén",
      shippedDate: null,
      returnDate: null,
    });
    expect(unit).not.toHaveProperty("purchaseCost");
  });

  it.each([
    ["ooc", true],
    ["presumedMissing", true],
    ["decommissioned", "true"],
    ["sold", true],
    ["deleted", true],
  ])("excludes unavailable units marked %s", (field, value) => {
    expect(normalizeMotorUnit({ id: "unit-1", serial: "SERIE-1", [field]: value }, MOTOR_MODELS[0]))
      .toBeNull();
  });

  it("requires both a Flex unit id and a serial number", () => {
    expect(normalizeMotorUnit({ serial: "SERIE-1" }, MOTOR_MODELS[0])).toBeNull();
    expect(normalizeMotorUnit({ id: "unit-1" }, MOTOR_MODELS[0])).toBeNull();
  });

  it("parses Flex pageable grid responses", () => {
    expect(parseMotorGridPage({ content: [{ id: "unit-1" }], totalElements: 3, last: false }))
      .toEqual({ rows: [{ id: "unit-1" }], totalElements: 3, last: false });
  });

  it("contains the nine supplied motor models without duplicate ids", () => {
    expect(MOTOR_MODELS).toHaveLength(9);
    expect(new Set(MOTOR_MODELS.map(({ id }) => id))).toHaveProperty("size", 9);
  });
});
