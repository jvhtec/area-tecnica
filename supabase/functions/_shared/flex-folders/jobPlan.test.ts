import { describe, expect, it } from "vitest";
import { buildJobPlan, makeJobStore } from "./jobPlan.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
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
    expect(plan.some((node) => node.payload.name === "Custom")).toBe(true);
    expect(plan.some((node) => FORBIDDEN_HOJA_DEFINITION_IDS.has(String(node.payload.definitionId)))).toBe(false);
  });

  it("keeps legacy single custom pullsheet metadata", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-legacy", title: "Job", job_type: "single" }, options: { sound: { subfolders: [], customPullsheet: { enabled: true, name: "Legacy custom", startDate: "2026-09-09T08:00:00.000Z", endDate: "2026-09-09T18:00:00.000Z" } } } });
    const custom = plan.find((node) => node.payload.name === "Legacy custom");
    expect(custom?.payload.plannedStartDate).toBe("2026-09-09T08:00:00.000Z");
    expect(custom?.payload.plannedEndDate).toBe("2026-09-09T18:00:00.000Z");
  });

  it("keeps default suffixes before numbering additional custom pullsheets", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-custom", title: "Job", job_type: "single" }, options: { sound: { subfolders: ["pullSheetTP", "pullSheetPA"], customPullsheet: { entries: [{ name: "One" }, { name: "Two" }, { name: "Three" }] } } } });
    const documents = plan.filter((node) => node.key.startsWith("department:sound:pullsheet:"))
      .map((node) => node.payload.documentNumber);
    expect(documents).toEqual(["260908STP", "260908SPA", "260908SPS01"]);
  });

  it("plans multiple commercial budgets without requiring an extras folder", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-commercial", title: "Job", job_type: "single" }, options: { comercial: { subfolders: ["presupuestoSound"], extrasPresupuesto: { entries: [{ name: "First", plannedStartDate: "start-1" }, { name: "Second", plannedEndDate: "end-2" }] } } } });
    const budgets = plan.filter((node) => node.key.startsWith("department:comercial:budget:sound"));
    expect(budgets).toHaveLength(2);
    expect(budgets.map((node) => node.parentKey)).toEqual(["department:comercial", "department:comercial"]);
    expect(budgets.map((node) => node.payload.documentNumber)).toEqual(["260908SQTPR01", "260908SQTPR02"]);
    expect(budgets.map((node) => node.payload.name)).toEqual(["Job - Sonido - First", "Job - Sonido - Second"]);
    expect(budgets[0].payload.plannedStartDate).toBe("start-1");
    expect(budgets[1].payload.plannedEndDate).toBe("end-2");
  });

  it("suppresses the PA pullsheet for tour-pack-only dates", () => {
    const tour = { flex_sound_folder_id: "sound-root", flex_production_folder_id: "production-root", flex_personnel_folder_id: "personnel-root", flex_comercial_folder_id: "commercial-root", flex_estructura_folder_id: "estructura-root" };
    const plan = buildJobPlan({ ...base, job: { id: "job-tp", title: "Date", job_type: "tourdate" }, tour, isTourPackOnly: true });
    expect(plan.some((node) => node.payload.documentNumber === "260908SPA")).toBe(false);
    expect(plan.some((node) => node.payload.documentNumber === "260908STP")).toBe(true);
  });

  it("tracks an external tour parent by its local flex_folders row", async () => {
    let inserted: Record<string, unknown> | undefined;
    const from = () => {
      let payload: Record<string, unknown> | undefined;
      let elementId = "";
      const query = {
        select: () => query,
        eq: (column: string, value: string) => { if (column === "element_id") elementId = value; return query; },
        insert: (value: Record<string, unknown>) => { payload = value; inserted = value; return query; },
        maybeSingle: async () => ({ data: elementId === "remote-tour-parent" ? { id: "local-tour-parent" } : null, error: null }),
        single: async () => ({ data: { id: "new-child-row", ...payload }, error: null }),
      };
      return query;
    };
    const store = makeJobStore({ from } as unknown as SupabaseClient, "operation", { id: "job", tour_date_id: "date" });
    await store.persistTracking({ key: "department:sound", externalParentElementId: "remote-tour-parent", payload: {}, tracking: { folderType: "tourdate", department: "sound" } }, "remote-child");
    expect(inserted?.parent_id).toBe("local-tour-parent");
  });

  it("places tour dates below authoritative tour department roots", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-2", title: "Date", job_type: "tourdate" }, tour: { flex_sound_folder_id: "sound-root", flex_production_folder_id: "production-root", flex_personnel_folder_id: "personnel-root", flex_comercial_folder_id: "commercial-root", flex_estructura_folder_id: "estructura-root" } });
    expect(plan.find((node) => node.key === "department:sound")?.externalParentElementId).toBe("sound-root");
    expect(plan.find((node) => node.key === "department:estructura")?.externalParentElementId).toBe("estructura-root");
    expect(plan.some((node) => node.key === "root")).toBe(false);
  });
});
