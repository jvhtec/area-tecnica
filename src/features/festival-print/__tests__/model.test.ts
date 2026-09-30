import { describe, expect, it } from "vitest";

import { defaultPrintOptions, printFilename, setAllStages, toggleStage } from "../model";

describe("defaultPrintOptions", () => {
  it("includes every document on every stage, as one combined PDF", () => {
    const options = defaultPrintOptions(3);
    expect(options.includeGearSetup && options.includeMissingRiderReport && options.includeWeatherPrediction).toBe(true);
    expect(options.gearSetupStages).toEqual([1, 2, 3]);
    expect(options.wiredMicNeedsStages).toEqual([1, 2, 3]);
    expect(options.generateIndividualStagePDFs).toBe(false);
  });

  it("gives each section its own stage list", () => {
    const options = defaultPrintOptions(2);
    expect(options.gearSetupStages).not.toBe(options.shiftScheduleStages);
  });
});

describe("toggleStage", () => {
  it("adds a stage keeping the list sorted, and only once", () => {
    const options = { ...defaultPrintOptions(3), rfIemTableStages: [1, 3] };
    const added = toggleStage(options, "rfIemTableStages", 2, true);
    expect(added.rfIemTableStages).toEqual([1, 2, 3]);
    expect(toggleStage(added, "rfIemTableStages", 2, true).rfIemTableStages).toEqual([1, 2, 3]);
  });

  it("removes a stage from one section only", () => {
    const options = defaultPrintOptions(3);
    const next = toggleStage(options, "gearSetupStages", 2, false);
    expect(next.gearSetupStages).toEqual([1, 3]);
    expect(next.shiftScheduleStages).toEqual([1, 2, 3]);
    expect(options.gearSetupStages).toEqual([1, 2, 3]);
  });
});

describe("setAllStages", () => {
  it("clears and refills every section's stages", () => {
    const cleared = setAllStages(defaultPrintOptions(3), 3, false);
    expect(cleared.gearSetupStages).toEqual([]);
    expect(cleared.artistRequirementStages).toEqual([]);
    expect(cleared.wiredMicNeedsStages).toEqual([]);
    expect(setAllStages(cleared, 3, true).infrastructureTableStages).toEqual([1, 2, 3]);
  });

  it("leaves the include switches alone", () => {
    const options = { ...defaultPrintOptions(2), includeGearSetup: false };
    expect(setAllStages(options, 2, false).includeGearSetup).toBe(false);
  });
});

describe("printFilename", () => {
  const only = (key: keyof ReturnType<typeof defaultPrintOptions>) => {
    const options = defaultPrintOptions(3);
    for (const k of Object.keys(options) as Array<keyof typeof options>) {
      if (k.startsWith("include")) (options[k] as boolean) = false;
    }
    (options[key] as boolean) = true;
    return options;
  };

  it("is a zip when one PDF per stage is asked for", () => {
    const options = { ...defaultPrintOptions(2), generateIndividualStagePDFs: true };
    expect(printFilename(options, "Sonorama", 2)).toMatch(/Sonorama.*Documentación por escenario.*\.zip$/);
  });

  it("names the document when there is only one", () => {
    expect(printFilename(only("includeRfIemTable"), "Sonorama", 3)).toContain("Tabla RF IEM");
    expect(printFilename(only("includeMissingRiderReport"), "Sonorama", 3)).toContain("Riders faltantes");
  });

  it("calls a mixed selection the full documentation", () => {
    expect(printFilename(defaultPrintOptions(3), "Sonorama", 3)).toContain("Documentación completa");
  });

  it("names the stage only when it narrows the festival down", () => {
    const one = setAllStages(defaultPrintOptions(3), 3, false);
    one.gearSetupStages = [2];
    one.includeShiftSchedules = false;
    one.includeArtistTables = false;
    one.includeArtistRequirements = false;
    one.includeRfIemTable = false;
    one.includeInfrastructureTable = false;
    one.includeWiredMicNeeds = false;
    one.includeWeatherPrediction = false;
    one.includeMissingRiderReport = false;
    expect(printFilename(one, "Sonorama", 3)).toContain("Escenario 2");

    const two = { ...one, gearSetupStages: [1, 3] };
    expect(printFilename(two, "Sonorama", 3)).toContain("Escenarios 1, 3");

    const all = { ...one, gearSetupStages: [1, 2, 3] };
    expect(printFilename(all, "Sonorama", 3)).not.toContain("Escenario");
  });

  it("ignores the stages of sections that are switched off", () => {
    const options = { ...defaultPrintOptions(3), includeShiftSchedules: false, shiftScheduleStages: [1] };
    expect(printFilename(options, "Sonorama", 3)).not.toContain("Escenario 1");
  });

  it("falls back to 'Festival' without a title", () => {
    expect(printFilename(defaultPrintOptions(1), "", 1)).toContain("Festival");
  });
});
