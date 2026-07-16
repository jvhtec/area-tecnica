import { describe, expect, it } from "vitest";

import {
  buildMotorSerialUnitGridUrl,
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
    ["decommissioned", "true"],
    ["sold", true],
    ["deleted", true],
  ])("excludes unavailable units marked %s", (field, value) => {
    expect(normalizeMotorUnit({ id: "unit-1", serial: "SERIE-1", [field]: value }, MOTOR_MODELS[0]))
      .toBeNull();
  });

  it.each([
    ["ooc", true],
    ["outOfCommission", true],
    ["presumedMissing", true],
  ])("keeps repairable serial units included by the Flex grid's %s filter", (field, value) => {
    expect(normalizeMotorUnit({ id: "unit-1", serial: "SERIE-1", [field]: value }, MOTOR_MODELS[0]))
      .toEqual(expect.objectContaining({ id: "unit-1", serial: "SERIE-1" }));
  });

  it("requires both a Flex unit id and a serial number", () => {
    expect(normalizeMotorUnit({ serial: "SERIE-1" }, MOTOR_MODELS[0])).toBeNull();
    expect(normalizeMotorUnit({ id: "unit-1" }, MOTOR_MODELS[0])).toBeNull();
  });

  it("parses Flex pageable grid responses", () => {
    expect(parseMotorGridPage({ content: [{ id: "unit-1" }], totalElements: 3, last: false }))
      .toEqual({ rows: [{ id: "unit-1" }], totalElements: 3, last: false });
  });

  it("parses the ExtJS rows envelope returned by Flex serial-unit grids", () => {
    expect(parseMotorGridPage({ rows: [{ id: "unit-1" }], total: "1" }))
      .toEqual({ rows: [{ id: "unit-1" }], totalElements: 1, last: null });
  });

  it("normalizes serial-unit fields nested under the Flex grid data property", () => {
    expect(normalizeMotorUnit({
      id: "unit-1",
      data: {
        serialNumber: "J36717",
        barcode: "04113-01",
        currentLocation: { displayString: "Almacén" },
      },
    }, MOTOR_MODELS[2])).toEqual(expect.objectContaining({
      id: "unit-1",
      modelId: MOTOR_MODELS[2].id,
      serial: "J36717",
      barcode: "04113-01",
      currentLocation: "Almacén",
    }));
  });

  it("builds the Flex serial-unit grid request used by the inventory UI", () => {
    const url = buildMotorSerialUnitGridUrl({
      apiBaseUrl: "https://sectorpro.flexrentalsolutions.com/f5/api",
      modelId: MOTOR_MODELS[3].id,
      pageIndex: 1,
      pageSize: 25,
      cacheBuster: 123,
    });

    expect(url.pathname).toBe("/f5/api/serial-unit/grid-node");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      _dc: "123",
      modelId: MOTOR_MODELS[3].id,
      page: "2",
      start: "25",
      size: "25",
      sort: "createdDate,DESC",
      dir: "",
    });
    expect(JSON.parse(url.searchParams.get("filter") || "[]")).toEqual([
      { property: "includeOut", value: true },
      { property: "includeOOC", value: true },
      { property: "includePresumedMissing", value: true },
    ]);
  });

  it("contains the nine supplied motor models without duplicate ids", () => {
    expect(MOTOR_MODELS).toHaveLength(9);
    expect(new Set(MOTOR_MODELS.map(({ id }) => id))).toHaveProperty("size", 9);
  });
});
