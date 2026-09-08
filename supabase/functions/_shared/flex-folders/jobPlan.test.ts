import { describe, expect, it } from "vitest";
import { buildJobPlan } from "./jobPlan.ts";
import { FORBIDDEN_HOJA_DEFINITION_IDS } from "./engine.ts";

const base = {
  selected: new Set(["sound"]),
  start: "2026-09-08T10:00:00.000Z",
  end: "2026-09-08T20:00:00.000Z",
  documentNumber: "260908",
};

describe("server-owned job plans", () => {
  it("normalizes an explicit selection without any deprecated Hoja definition", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-1", title: "Job", job_type: "single" }, options: { sound: { subfolders: ["documentacionTecnica", "hojaInfo"], customPullsheet: { entries: [{ name: "Custom" }] } } } });
    expect(plan.some((node) => node.key === "department:sound:documentacionTecnica")).toBe(true);
    expect(plan.some((node) => node.key === "department:sound:custom-pullsheet:0")).toBe(true);
    expect(plan.some((node) => FORBIDDEN_HOJA_DEFINITION_IDS.has(String(node.payload.definitionId)))).toBe(false);
  });

  it("places tour dates below authoritative tour department roots", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-2", title: "Date", job_type: "tourdate" }, tour: { flex_sound_folder_id: "sound-root", flex_production_folder_id: "production-root", flex_personnel_folder_id: "personnel-root", flex_comercial_folder_id: "commercial-root", flex_estructura_folder_id: "estructura-root" } });
    expect(plan.find((node) => node.key === "department:sound")?.externalParentElementId).toBe("sound-root");
    expect(plan.find((node) => node.key === "department:estructura")?.externalParentElementId).toBe("estructura-root");
    expect(plan.some((node) => node.key === "root")).toBe(false);
  });
});
