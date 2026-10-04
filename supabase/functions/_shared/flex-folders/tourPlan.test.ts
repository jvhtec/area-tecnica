import { describe, expect, it } from "vitest";

import {
  buildRootPlan,
  childDepartmentsForTour,
  plannerOwnedTourSemanticKeys,
  selectedDepartmentsForTour,
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
  it("recovers departments from legacy Flex roots when a tour has no date jobs", () => {
    const record = tour({
      flex_sound_folder_id: "sound",
      flex_lights_folder_id: null,
      flex_video_folder_id: "video",
    });

    expect([...selectedDepartmentsForTour(record, new Set())]).toEqual(["sound", "video"]);
  });

  it("does not infer departments for a new tour without a Flex root", () => {
    const record = tour({
      flex_main_folder_id: null,
      flex_sound_folder_id: "sound",
    });

    expect(selectedDepartmentsForTour(record, new Set())).toEqual(new Set());
  });

  it("prefers persisted job departments when they exist", () => {
    const record = tour({ flex_video_folder_id: "video" });

    expect(selectedDepartmentsForTour(record, new Set(["lights"]))).toEqual(new Set(["lights"]));
  });

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

  it("creates one stable commercial package container for every selected technical department", () => {
    const record = tour({
      flex_main_folder_id: null,
      flex_sound_folder_id: null,
      flex_lights_folder_id: null,
      flex_video_folder_id: null,
      flex_production_folder_id: null,
      flex_personnel_folder_id: null,
      flex_comercial_folder_id: null,
      flex_estructura_folder_id: null,
    });
    const selected = new Set(["sound", "lights", "video"]);
    const childDepartments = childDepartmentsForTour(record, selected, new Set());
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);
    const commercial = plan.filter((node) => node.key.startsWith("department:comercial:packages:"));

    expect(commercial.map((node) => node.key)).toEqual([
      "department:comercial:packages:sound",
      "department:comercial:packages:lights",
      "department:comercial:packages:video",
    ]);
    expect(commercial.map((node) => node.payload.name)).toEqual([
      "Tour - Comercial - Sonido",
      "Tour - Comercial - Luces",
      "Tour - Comercial - Video",
    ]);
    expect(commercial.map((node) => node.payload.documentNumber)).toEqual([
      "260908SQT",
      "260908LQT",
      "260908VQT",
    ]);
    expect(commercial.every((node) =>
      node.parentKey === "department:comercial" &&
      node.tracking.folderType === "tour_commercial_department"
    )).toBe(true);
  });

  it("does not create a commercial package branch for an unselected technical department", () => {
    const record = tour({ flex_comercial_folder_id: null });
    const selected = new Set(["sound", "lights"]);
    const childDepartments = childDepartmentsForTour(record, selected, new Set());
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.some((node) => node.key === "department:comercial:packages:sound")).toBe(true);
    expect(plan.some((node) => node.key === "department:comercial:packages:lights")).toBe(true);
    expect(plan.some((node) => node.key === "department:comercial:packages:video")).toBe(false);
  });

  it("adds missing commercial package branches when the commercial root belongs to the durable planner", () => {
    const record = tour();
    const selected = new Set(["sound", "lights", "video"]);
    const childDepartments = childDepartmentsForTour(
      record,
      selected,
      new Set(["root", "department:comercial"]),
    );
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.filter((node) => node.key.startsWith("department:comercial:packages:"))).toHaveLength(3);
  });

  it("does not guess package children beneath an adopted legacy commercial root", () => {
    const record = tour();
    const selected = new Set(["sound", "lights", "video"]);
    const childDepartments = childDepartmentsForTour(record, selected, new Set());
    const plan = buildRootPlan(record, selected, { start: record.start_date!, end: record.end_date! }, childDepartments);

    expect(plan.some((node) => node.key.startsWith("department:comercial:packages:"))).toBe(false);
  });
});
