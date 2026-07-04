import { describe, it, expect } from "vitest";
import {
  suggestSpareQuantity,
  suggestMicrophoneSpares,
  applyMicrophoneSpares,
} from "@/utils/microphoneSpares";
import type { WiredMic } from "@/components/festival/gear-setup/WiredMicConfig";

describe("suggestSpareQuantity", () => {
  it("suggests no spare for a zero or negative peak", () => {
    expect(suggestSpareQuantity(0)).toBe(0);
    expect(suggestSpareQuantity(-3)).toBe(0);
  });

  it("suggests at least one spare for any model in use", () => {
    expect(suggestSpareQuantity(1)).toBe(1);
    expect(suggestSpareQuantity(5)).toBe(1);
    expect(suggestSpareQuantity(10)).toBe(1);
  });

  it("scales up with the default 10% rate, rounding up", () => {
    expect(suggestSpareQuantity(11)).toBe(2);
    expect(suggestSpareQuantity(20)).toBe(2);
    expect(suggestSpareQuantity(21)).toBe(3);
  });

  it("honors a custom rate and minimum", () => {
    expect(suggestSpareQuantity(8, { rate: 0.25 })).toBe(2);
    expect(suggestSpareQuantity(2, { minSpare: 2 })).toBe(2);
  });

  it("caps the suggestion at maxSpare", () => {
    expect(suggestSpareQuantity(100, { maxSpare: 4 })).toBe(4);
  });
});

describe("suggestMicrophoneSpares", () => {
  it("produces a suggestion per usable model and skips empties", () => {
    const requirements: WiredMic[] = [
      { model: "SM58", quantity: 12 },
      { model: "Beta 52", quantity: 3 },
      { model: "", quantity: 5 },
      { model: "KM184", quantity: 0 },
    ];

    const suggestions = suggestMicrophoneSpares(requirements);

    expect(suggestions).toEqual([
      { model: "SM58", peakQuantity: 12, spareQuantity: 2 },
      { model: "Beta 52", peakQuantity: 3, spareQuantity: 1 },
    ]);
  });
});

describe("applyMicrophoneSpares", () => {
  it("adds the chosen spares to quantities and annotates the note", () => {
    const requirements: WiredMic[] = [
      { model: "SM58", quantity: 12, notes: "Pico por escenario (4 artistas)" },
      { model: "Beta 52", quantity: 3 },
    ];

    const result = applyMicrophoneSpares(requirements, { SM58: 2, "Beta 52": 1 });

    expect(result[0]).toEqual({
      model: "SM58",
      quantity: 14,
      notes: "Pico por escenario (4 artistas) · +2 repuestos",
    });
    expect(result[1]).toEqual({
      model: "Beta 52",
      quantity: 4,
      notes: "+1 repuesto",
    });
  });

  it("leaves models with no spare untouched", () => {
    const requirements: WiredMic[] = [{ model: "SM58", quantity: 12, notes: "keep" }];

    const result = applyMicrophoneSpares(requirements, { SM58: 0 });

    expect(result[0]).toBe(requirements[0]);
  });
});
