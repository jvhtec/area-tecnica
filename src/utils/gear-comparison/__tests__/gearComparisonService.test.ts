import { describe, it, expect } from "vitest";
import {
  compareArtistRequirements,
  calculateEquipmentNeeds,
  getMismatchSummary,
  type ArtistGearComparison,
} from "@/utils/gearComparisonService";

// These exercise the public API through the barrel, which also guards the
// gearComparisonService -> gear-comparison/* module split against regressions.

// Minimal artist whose only active requirement is the FOH console; every other
// section (monitors, wireless, iem, mics, infra, extras) is empty/disabled so
// the assertions stay focused.
const makeArtist = (overrides: Record<string, unknown> = {}) =>
  ({
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
  }) as any;

const globalSetupWith = (fohConsoles: Array<{ model: string; quantity: number }>) =>
  ({
    foh_consoles: fohConsoles,
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    wired_mics: [],
    available_monitors: 0,
  }) as any;

describe("compareArtistRequirements", () => {
  it("reports no mismatches when the requested FOH console is available (stage 1 / global setup)", () => {
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
