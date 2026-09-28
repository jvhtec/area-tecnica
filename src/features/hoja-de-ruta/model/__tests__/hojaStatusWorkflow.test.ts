import { describe, expect, it } from "vitest";

import { shouldStopTransitionAfterSave } from "@/features/hoja-de-ruta/model/hojaStatusWorkflow";

describe("Hoja status workflow", () => {
  it("stops finalization when saving dirty approved content invalidates approval", () => {
    expect(shouldStopTransitionAfterSave("approved", "final", true)).toBe(true);
  });

  it("allows finalization when approved content did not need saving", () => {
    expect(shouldStopTransitionAfterSave("approved", "final", false)).toBe(false);
  });

  it("stops non-admin self-approval after saving review changes", () => {
    expect(shouldStopTransitionAfterSave("review", "approved", true)).toBe(true);
  });

  it("keeps the admin self-approval exemption after saving review changes", () => {
    expect(shouldStopTransitionAfterSave("review", "approved", true, true)).toBe(false);
  });

  it("does not block the normal draft to review transition", () => {
    expect(shouldStopTransitionAfterSave("draft", "review", true)).toBe(false);
  });
});
