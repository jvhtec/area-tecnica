import { describe, expect, it } from "vitest";

import type { FlexPullsheetTransportLine } from "@/services/flexPullsheets";
import {
  normalizeSoundPullsheetTransport,
  type SoundTransportProfile,
  type SoundTransportRule,
} from "../soundTransportNormalizer";

const k2Cart: SoundTransportProfile = {
  id: "profile-k2-cart",
  skuId: "lacoustics:k2:4:chariot",
  name: "L-Acoustics K2 (4) w/ Chariot",
  lengthMm: 353,
  widthMm: 1339,
  heightMm: 1514,
  weightKg: 246.2,
  transportKind: "cart",
  blocksVerticalColumn: true,
  uprightOnly: true,
  tiltAllowed: false,
  allowedYaw: [0, 90, 180, 270],
  canBeBase: false,
  topContactAllowed: false,
  maxLoadAboveKg: 0,
  minSupportRatio: 1,
  stackClass: "FLOOR_ONLY,MAX_LEVEL_1",
  sourceKind: "truckpacker",
  sourceUrl: "https://www.truckpacker.com/manufacturer-library/cases/l-acoustics",
  sourceExternalKey: "truckpacker:l-acoustics:k2-4-chariot",
};

const k2Rule: SoundTransportRule = {
  id: "rule-k2",
  sourceBarcode: "00160",
  sourceName: "K2",
  equipmentUnitsPerTransport: 4,
  profile: k2Cart,
};

function line(patch: Partial<FlexPullsheetTransportLine> = {}): FlexPullsheetTransportLine {
  return {
    description: "K2",
    quantity: 24,
    itemBarcode: "00160",
    itemLengthCm: 134,
    itemWidthCm: 40,
    itemHeightCm: 35.4,
    noteText: null,
    isVirtual: false,
    ...patch,
  };
}

describe("normalizeSoundPullsheetTransport", () => {
  it("normalizes 24 K2 into six loaded four-high chariots", () => {
    const result = normalizeSoundPullsheetTransport([line()], [k2Rule]);

    expect(result.unresolved).toEqual([]);
    expect(result.transports).toHaveLength(1);
    expect(result.transports[0]).toMatchObject({
      quantity: 6,
      sourceQuantity: 24,
      equipmentUnitsPerTransport: 4,
      spareCapacity: 0,
      origin: "generated",
      matchedBy: "barcode",
    });
    expect(result.transports[0].profile).toMatchObject({
      lengthMm: 353,
      widthMm: 1339,
      heightMm: 1514,
      blocksVerticalColumn: true,
    });
  });

  it("aggregates split Pull Sheet lines before rounding transport quantity", () => {
    const result = normalizeSoundPullsheetTransport(
      [line({ quantity: 10 }), line({ quantity: 14 })],
      [k2Rule],
    );

    expect(result.transports[0].sourceQuantity).toBe(24);
    expect(result.transports[0].quantity).toBe(6);
  });

  it("rounds only the final partially-filled transport unit", () => {
    const result = normalizeSoundPullsheetTransport([line({ quantity: 25 })], [k2Rule]);

    expect(result.transports[0].quantity).toBe(7);
    expect(result.transports[0].spareCapacity).toBe(3);
  });

  it("prefers barcode identity over an exact name rule", () => {
    const wrongByName: SoundTransportRule = {
      ...k2Rule,
      id: "wrong-by-name",
      sourceBarcode: null,
      sourceName: "K2",
      profile: { ...k2Cart, id: "wrong-profile", skuId: "wrong", name: "Wrong" },
    };

    const result = normalizeSoundPullsheetTransport([line()], [wrongByName, k2Rule]);

    expect(result.transports).toHaveLength(1);
    expect(result.transports[0].profile.skuId).toBe("lacoustics:k2:4:chariot");
    expect(result.transports[0].matchedBy).toBe("barcode");
  });

  it("does not guess when a Pull Sheet model has no explicit rule", () => {
    const unknown = line({
      description: "Some mystery monitor",
      itemBarcode: "99999",
      quantity: 8,
    });

    const result = normalizeSoundPullsheetTransport([unknown], [k2Rule]);

    expect(result.transports).toEqual([]);
    expect(result.unresolved).toEqual([{ line: unknown, reason: "no_transport_rule" }]);
  });

  it("ignores virtual/category rows", () => {
    const result = normalizeSoundPullsheetTransport(
      [line({ description: "Material de Sonido", itemBarcode: null, quantity: 1, isVirtual: true })],
      [k2Rule],
    );

    expect(result.sourceLineCount).toBe(0);
    expect(result.transports).toEqual([]);
    expect(result.unresolved).toEqual([]);
  });
});
