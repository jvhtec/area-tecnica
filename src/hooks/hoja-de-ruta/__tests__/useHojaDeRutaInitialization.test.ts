import { describe, expect, it } from "vitest";

import { resolvePowerRequirementsForHojaInitialization } from "@/hooks/hoja-de-ruta/useHojaDeRutaInitialization";

describe("resolvePowerRequirementsForHojaInitialization", () => {
  it("keeps saved manual Hoja power requirements over generated table text", () => {
    expect(
      resolvePowerRequirementsForHojaInitialization({
        savedPowerRequirements: "Manual override\nCEE63A",
        generatedPowerRequirements: "Generated power table",
      })
    ).toBe("Manual override\nCEE63A");
  });

  it("uses generated power requirements when the saved Hoja field is empty", () => {
    expect(
      resolvePowerRequirementsForHojaInitialization({
        savedPowerRequirements: "  ",
        generatedPowerRequirements: "Generated power table",
      })
    ).toBe("Generated power table");
  });
});
