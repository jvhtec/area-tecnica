import { describe, expect, it } from "vitest";

import {
  hydrateFromDB,
  mergeMicLists,
  sanitizeWiredMics,
  validateMicList,
} from "@/utils/micListTransform";

describe("micListTransform", () => {
  it("hydrates JSON payloads into normalized microphone entries", () => {
    const hydrated = hydrateFromDB(
      JSON.stringify([
        { model: "SM58", quantity: 2, exclusive_use: true, notes: "Lead vox" },
        { model: "Beta 52", quantity: 0 },
      ]),
    );

    expect(hydrated).toEqual([
      { model: "SM58", quantity: 2, exclusive_use: true, notes: "Lead vox" },
      { model: "Beta 52", quantity: 1, exclusive_use: false, notes: undefined },
    ]);
  });

  it("merges duplicate microphone models and preserves exclusive-use flags", () => {
    const merged = mergeMicLists(
      [
        { model: "SM58", quantity: 2, notes: "Lead" },
        { model: "Beta 91", quantity: 1 },
      ],
      [
        { model: "SM58", quantity: 1, exclusive_use: true, notes: "Guest" },
        { model: "e904", quantity: 3 },
      ],
    );

    expect(merged).toEqual([
      { model: "Beta 91", quantity: 1 },
      { model: "e904", quantity: 3 },
      { model: "SM58", quantity: 3, exclusive_use: true, notes: "Lead; Guest" },
    ]);
  });

  it("sanitizes stored microphone rows and reports invalid payloads", () => {
    const malformedRows = [
      { model: "KSM9", quantity: 2, exclusive_use: false, notes: "  Main act  " },
      { model: "  ", quantity: 0 },
    ] as unknown as Parameters<typeof sanitizeWiredMics>[0];

    expect(
      sanitizeWiredMics(malformedRows),
    ).toEqual([{ model: "KSM9", quantity: 2, notes: "Main act" }]);

    expect(
      validateMicList([
        { model: "SM58", quantity: 2 },
        { model: "", quantity: 0, exclusive_use: "yes" },
      ]),
    ).toEqual({
      valid: false,
      errors: [
        "Item at index 1 is missing or has invalid model name",
        "Item at index 1 has invalid quantity (must be >= 1)",
        "Item at index 1 has invalid exclusive_use value (must be boolean)",
      ],
    });
  });
});
