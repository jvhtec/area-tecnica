import { describe, it, expect } from "vitest";
import {
  compareArtistRequirements,
  calculateEquipmentNeeds,
  getMismatchSummary,
  type ArtistGearComparison,
  type ArtistRequirements,
} from "@/utils/gearComparisonService";
import type { ConsoleSetup, FestivalGearSetup, StageGearSetup } from "@/types/festival";

// These exercise the public API through the barrel, which also guards the
// gearComparisonService -> gear-comparison/* module split against regressions.

// Minimal artist whose only active requirement is the FOH console; every other
// section (monitors, wireless, iem, mics, infra, extras) is empty/disabled so
// the assertions stay focused.
const makeArtist = (overrides: Partial<ArtistRequirements> = {}): ArtistRequirements => ({
  name: "Test Band",
  stage: 1,
  foh_console: "",
  mon_console: "",
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [],
  monitors_enabled: false,
  monitors_quantity: 0,
  extras_sf: false,
  extras_df: false,
  extras_djbooth: false,
  ...overrides,
});

const baseGlobalSetup: FestivalGearSetup = {
  id: "gear-1",
  job_id: "job-1",
  max_stages: 2,
  foh_consoles: [],
  mon_consoles: [],
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [],
  available_monitors: 0,
  has_side_fills: false,
  has_drum_fills: false,
  has_dj_booths: false,
  available_cat6_runs: 0,
  available_hma_runs: 0,
  available_coax_runs: 0,
  available_analog_runs: 0,
  available_opticalcon_duo_runs: 0,
};

const globalSetupWith = (fohConsoles: ConsoleSetup[]): FestivalGearSetup => ({
  ...baseGlobalSetup,
  foh_consoles: fohConsoles,
});

const makeStageSetup = (overrides: Partial<StageGearSetup> = {}): StageGearSetup => ({
  id: "stage-1",
  gear_setup_id: "gear-1",
  stage_number: 1,
  foh_consoles: [],
  mon_consoles: [],
  wireless_systems: [],
  iem_systems: [],
  wired_mics: [],
  monitors_enabled: false,
  monitors_quantity: 0,
  extras_sf: false,
  extras_df: false,
  extras_djbooth: false,
  extras_wired: null,
  infra_cat6: false,
  infra_cat6_quantity: 0,
  infra_hma: false,
  infra_hma_quantity: 0,
  infra_coax: false,
  infra_coax_quantity: 0,
  infra_opticalcon_duo: false,
  infra_opticalcon_duo_quantity: 0,
  infra_analog: 0,
  other_infrastructure: null,
  notes: null,
  ...overrides,
});

describe("compareArtistRequirements", () => {
  it("reports no console mismatch when the requested FOH console is available (stage 1 / global setup)", () => {
    const artist = makeArtist({ foh_console: "SD7", foh_console_provided_by: "festival" });
    const result = compareArtistRequirements(artist, globalSetupWith([{ model: "SD7", quantity: 1 }]), null);

    expect(result.artistName).toBe("Test Band");
    expect(result.stage).toBe(1);
    // No console mismatch when the requested console is in stock; an unrelated
    // info note (band-provided mic kit) may exist but must not be a conflict.
    expect(result.mismatches.filter((m) => m.type === "console")).toHaveLength(0);
    expect(result.hasConflicts).toBe(false);
  });

  it("flags an error when the requested FOH console is not in the available inventory", () => {
    const artist = makeArtist({ foh_console: "PM5D", foh_console_provided_by: "festival" });
    const result = compareArtistRequirements(artist, globalSetupWith([{ model: "SD7", quantity: 1 }]), null);

    const consoleErrors = result.mismatches.filter((m) => m.type === "console" && m.severity === "error");
    expect(consoleErrors).toHaveLength(1);
    expect(consoleErrors[0].message).toContain("PM5D");
    expect(result.hasConflicts).toBe(true);
  });

  it("treats a band-provided console as info, not an error", () => {
    const artist = makeArtist({ foh_console: "PM5D", foh_console_provided_by: "band" });
    const result = compareArtistRequirements(artist, globalSetupWith([]), null);

    expect(result.mismatches.every((m) => m.severity !== "error")).toBe(true);
    expect(result.mismatches.some((m) => m.severity === "info")).toBe(true);
    expect(result.hasConflicts).toBe(false);
  });

  it("uses an empty inventory for non-stage-1 artists with no stage setup", () => {
    const artist = makeArtist({ stage: 2, foh_console: "SD7", foh_console_provided_by: "festival" });
    // Global setup has SD7, but a stage-2 artist must not inherit the global inventory.
    const result = compareArtistRequirements(artist, globalSetupWith([{ model: "SD7", quantity: 1 }]), null);

    expect(result.mismatches.some((m) => m.type === "console" && m.severity === "error")).toBe(true);
  });

  it("prefers the global setup over a stage-specific setup for stage 1", () => {
    const artist = makeArtist({ stage: 1, foh_console: "SD7", foh_console_provided_by: "festival" });
    // Global has SD7; the stage-1 row only has PM5D. Per the rule, stage 1 must
    // resolve from the global setup, so SD7 is considered available (no error).
    const stageSetup = makeStageSetup({ stage_number: 1, foh_consoles: [{ model: "PM5D", quantity: 1 }] });
    const result = compareArtistRequirements(artist, globalSetupWith([{ model: "SD7", quantity: 1 }]), stageSetup);

    expect(result.mismatches.filter((m) => m.type === "console" && m.severity === "error")).toHaveLength(0);
  });

  it("matches console models case-insensitively", () => {
    const artist = makeArtist({ foh_console: "sd7", foh_console_provided_by: "festival" });
    const result = compareArtistRequirements(artist, globalSetupWith([{ model: "SD7", quantity: 1 }]), null);

    expect(result.mismatches.filter((m) => m.type === "console" && m.severity === "error")).toHaveLength(0);
  });
});

describe("calculateEquipmentNeeds", () => {
  it("returns a fully zeroed needs structure for an empty artist list", () => {
    const needs = calculateEquipmentNeeds([], globalSetupWith([]), {});

    expect(needs.consoles.foh).toEqual([]);
    expect(needs.consoles.monitor).toEqual([]);
    expect(needs.wireless).toEqual([]);
    expect(needs.iem).toEqual([]);
    expect(needs.microphones).toEqual([]);
    expect(needs.monitors.additionalQuantity).toBe(0);
    expect(needs.infrastructure.cat6.additionalQuantity).toBe(0);
    expect(needs.extras.sideFills.additionalStages).toBe(0);
  });

  it("accumulates an additional FOH console when an artist requests one that isn't available", () => {
    const artist = makeArtist({ stage: 1, foh_console: "PM5D", foh_console_provided_by: "festival" });
    const needs = calculateEquipmentNeeds([artist], globalSetupWith([]), {});

    const pm5d = needs.consoles.foh.find((c) => c.model === "PM5D");
    expect(pm5d).toBeDefined();
    // needs are attributed by stage label, not artist name.
    expect(pm5d!.requiredBy).toContain("Stage 1");
  });

  it("does not create a shortage when the available model differs only by case", () => {
    const artist = makeArtist({ stage: 1, foh_console: "sd7", foh_console_provided_by: "festival" });
    const needs = calculateEquipmentNeeds([artist], globalSetupWith([{ model: "SD7", quantity: 1 }]), {});

    expect(needs.consoles.foh).toHaveLength(0);
  });
});

describe("getMismatchSummary", () => {
  it("aggregates totals and lists only the conflicting artists", () => {
    const comparisons: ArtistGearComparison[] = [
      {
        artistName: "A",
        stage: 1,
        hasConflicts: true,
        mismatches: [
          { type: "console", severity: "error", message: "boom" },
          { type: "wireless", severity: "warning", message: "warn" },
        ],
      },
      {
        artistName: "B",
        stage: 2,
        hasConflicts: false,
        mismatches: [{ type: "console", severity: "info", message: "fyi" }],
      },
    ];

    const summary = getMismatchSummary(comparisons);

    expect(summary.totalArtists).toBe(2);
    expect(summary.artistsWithConflicts).toBe(1);
    expect(summary.totalErrors).toBe(1);
    expect(summary.totalWarnings).toBe(1);
    expect(summary.conflicts).toHaveLength(1);
    expect(summary.conflicts[0].artist).toBe("A");
  });
});
