import { describe, expect, it } from "vitest";

import type { TourDefaultSet } from "@/hooks/useTourDefaultSets";
import {
  buildPackageUpdatePayload,
  buildTourDateJobTitle,
  resolvePackageDefaultSetId,
} from "@/components/tours/tourDateManagementModel";

const makeSet = (
  id: string,
  department: TourDefaultSet["department"],
  packageSize: TourDefaultSet["package_size"],
): TourDefaultSet => ({
  id,
  tour_id: "tour-1",
  name: id,
  department,
  package_size: packageSize,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("tourDateManagementModel", () => {
  const defaultSets = [
    makeSet("sound-m", "sound", "m"),
    makeSet("sound-l-1", "sound", "l"),
    makeSet("sound-l-2", "sound", "l"),
    makeSet("lights-s", "lights", "s"),
  ];

  it("keeps a compatible explicit set and auto-selects only a unique package match", () => {
    expect(resolvePackageDefaultSetId(defaultSets, "sound", "m", "sound-m")).toBe("sound-m");
    expect(resolvePackageDefaultSetId(defaultSets, "sound", "m", "lights-s")).toBe("sound-m");
    expect(resolvePackageDefaultSetId(defaultSets, "sound", "l", null)).toBeNull();
    expect(resolvePackageDefaultSetId(defaultSets, "sound", null, "sound-m")).toBe("sound-m");
  });

  it("builds the three-department persistence payload", () => {
    expect(buildPackageUpdatePayload(
      defaultSets,
      { sound: "m", lights: "s", video: null },
      { sound: null, lights: null, video: null },
    )).toEqual({
      sound_package_size: "m",
      lights_package_size: "s",
      video_package_size: null,
      sound_default_set_id: "sound-m",
      lights_default_set_id: "lights-s",
      video_default_set_id: null,
    });
  });

  it("preserves the existing Spanish title conventions", () => {
    expect(buildTourDateJobTitle("Tour", "Madrid", "show")).toBe("Tour (Madrid)");
    expect(buildTourDateJobTitle("Tour", "", "rehearsal")).toContain("Sin ubicación");
  });
});
