import { describe, expect, it } from "vitest";

import { getHojaPowerSummaryStatus } from "@/utils/hoja-de-ruta/powerSummaryStatus";

describe("getHojaPowerSummaryStatus", () => {
  it("offers the calculator summary when the Hoja field is empty", () => {
    expect(
      getHojaPowerSummaryStatus({ generated: "SOUND - PA:\nPotencia total: 10.000 W", saved: "" })
    ).toBe("missing");
    expect(
      getHojaPowerSummaryStatus({ generated: "SOUND - PA:", saved: "   \n " })
    ).toBe("missing");
  });

  it("flags a saved copy that no longer matches the calculator", () => {
    expect(
      getHojaPowerSummaryStatus({ generated: "SOUND - PA: 12 kVA", saved: "SOUND - PA: 10 kVA" })
    ).toBe("stale");
  });

  it("stays quiet when the saved copy matches, ignoring surrounding whitespace", () => {
    expect(
      getHojaPowerSummaryStatus({ generated: "SOUND - PA:\n", saved: "  SOUND - PA:  " })
    ).toBe("up-to-date");
  });

  it("stays quiet when the job has no calculated tables at all", () => {
    expect(getHojaPowerSummaryStatus({ generated: "", saved: "Notas manuales" })).toBe("up-to-date");
    expect(getHojaPowerSummaryStatus({ generated: undefined, saved: undefined })).toBe("up-to-date");
  });
});
