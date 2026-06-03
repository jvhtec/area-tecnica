import { describe, expect, it } from "vitest";

import { appendTechnicalStageToFilename } from "@/features/technical-tools/stage/stageUtils";

describe("technical stage utilities", () => {
  it("sanitizes stage labels appended to filenames", () => {
    expect(
      appendTechnicalStageToFilename("Power Report.pdf", {
        number: 2,
        name: "Main/Alt\\Deck:Night",
      })
    ).toBe("Power Report - Main - Alt - Deck Night.pdf");
  });
});
