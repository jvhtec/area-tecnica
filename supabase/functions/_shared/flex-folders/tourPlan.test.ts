import { describe, expect, it } from "vitest";

import {
  buildRootPlan,
  childDepartmentsForTour,
  plannerOwnedTourSemanticKeys,
  type TourRecord,
} from "./tourPlan.ts";

const tour = (overrides: Partial<TourRecord> = {}): TourRecord => ({
  id: "tour",
  name: "Tour",
  start_date: "2026-09-08",
  end_date: "2026-09-09",
  flex_folders_created: true,
  flex_main_folder_id: "main",
  flex_sound_folder_id: "sound",
  flex_lights_folder_id: null,
  flex_video_folder_id: null,
  flex_production_folder_id: "production",
  flex_personnel_folder_id: "personnel",
  flex_comercial_folder_id: "commercial",
  flex_estructura_folder_id: "estructura",
  ...overrides,
});

describe("tour root plan expansion", () => {
  it("plans canonical children for a department added to a durable tour", () => {
    const record = tour();
    const selected = new Set(["sound", "lights"]);
    const childDepartments = childDepartmentsForTour(
      record,
      selected,
      new Set(["root", "department:sound"]),
    );
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.filter((node) => node.key.startsWith("department:lights:"))).toHaveLength(3);
    expect(plan.filter((node) => node.key.startsWith("department:sound:"))).toHaveLength(3);
    expect(new Set(plan.map((node) => node.key)).size).toBe(plan.length);
  });

  it("suppresses unknown children only beneath existing legacy department roots", () => {
    const record = tour();
    const selected = new Set(["sound", "lights"]);
    const childDepartments = childDepartmentsForTour(record, selected, new Set());
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.some((node) => node.key.startsWith("department:sound:"))).toBe(false);
    expect(plan.filter((node) => node.key.startsWith("department:lights:"))).toHaveLength(3);
  });

  it("keeps adopted legacy department roots conservative on later reruns", () => {
    const record = tour();
    const selected = new Set(["sound", "lights"]);
    const plannerOwnedKeys = plannerOwnedTourSemanticKeys([
      { semantic_key: "department:sound", payload: { provisioningOrigin: "legacy-tour-column" } },
      { semantic_key: "department:lights", payload: { definitionId: "new-system-root" } },
    ]);
    const childDepartments = childDepartmentsForTour(record, selected, plannerOwnedKeys);
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.some((node) => node.key.startsWith("department:sound:"))).toBe(false);
    expect(plan.filter((node) => node.key.startsWith("department:lights:"))).toHaveLength(3);
  });
});
