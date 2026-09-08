import { describe, expect, it, vi } from "vitest";
import { buildJobPlan, makeJobStore, matchLegacyJobElements } from "./jobPlan.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { executeProvisioningPlan, FORBIDDEN_HOJA_DEFINITION_IDS } from "./engine.ts";

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

  it("adopts legacy job rows by semantic role before creating remote elements", () => {
    const plan = [
      { key: "root", payload: {}, tracking: { folderType: "main_event" } },
      { key: "department:sound", parentKey: "root", payload: {}, tracking: { folderType: "department", department: "sound" } },
      { key: "department:sound:pullsheet:TP", parentKey: "department:sound", payload: {}, tracking: { folderType: "pull_sheet", department: "sound" } },
      { key: "department:sound:pullsheet:PA", parentKey: "department:sound", payload: {}, tracking: { folderType: "pull_sheet", department: "sound" } },
      { key: "estructura:source:sound", parentKey: "department:estructura", payload: {}, tracking: { folderType: "pull_sheet", department: "estructura", sourceDepartment: "sound" } },
    ];
    const rows = [
      { id: "local-root", element_id: "remote-root", parent_id: null, folder_type: "main_event", department: null, source_department: null, job_id: "job" },
      { id: "local-sound", element_id: "remote-sound", parent_id: "remote-root", folder_type: "department", department: "sound", source_department: null, job_id: "job" },
      { id: "local-tp", element_id: "remote-tp", parent_id: "local-sound", folder_type: "pull_sheet", department: "sound", source_department: null, job_id: "job" },
      { id: "local-pa", element_id: "remote-pa", parent_id: "local-sound", folder_type: "pull_sheet", department: "sound", source_department: null, job_id: "job" },
      { id: "local-es", element_id: "remote-es", parent_id: "estructura", folder_type: "pull_sheet", department: "estructura", source_department: "sound", job_id: null },
    ];
    const matches = matchLegacyJobElements(rows, new Map(), plan);
    expect([...matches.entries()].map(([key, row]) => [key, row.element_id])).toEqual([
      ["root", "remote-root"],
      ["department:sound", "remote-sound"],
      ["department:sound:pullsheet:TP", "remote-tp"],
      ["department:sound:pullsheet:PA", "remote-pa"],
      ["estructura:source:sound", "remote-es"],
    ]);
  });

  it("incrementally adopts legacy children exposed by a later plan expansion", async () => {
    const root = { key: "root", payload: {}, tracking: { folderType: "main_event" } };
    const sound = { key: "department:sound", parentKey: "root", payload: {}, tracking: { folderType: "department", department: "sound" } };
    const tp = { key: "department:sound:pullsheet:TP", parentKey: "department:sound", payload: {}, tracking: { folderType: "pull_sheet", department: "sound" } };
    const pa = { key: "department:sound:pullsheet:PA", parentKey: "department:sound", payload: {}, tracking: { folderType: "pull_sheet", department: "sound" } };
    const rows = [
      { id: "local-root", element_id: "remote-root", parent_id: null, folder_type: "main_event", department: null, source_department: null, job_id: "job" },
      { id: "local-sound", element_id: "remote-sound", parent_id: "local-root", folder_type: "department", department: "sound", source_department: null, job_id: "job" },
      { id: "local-tp", element_id: "remote-tp", parent_id: "local-sound", folder_type: "pull_sheet", department: "sound", source_department: null, job_id: "job" },
      { id: "local-pa", element_id: "remote-pa", parent_id: "local-sound", folder_type: "pull_sheet", department: "sound", source_department: null, job_id: "job" },
    ];
    const firstPlan = [root, sound, tp];
    const firstMatches = matchLegacyJobElements(rows, new Map(), firstPlan);
    const existingNodes = [...firstMatches].map(([semantic_key, row]) => ({
      semantic_key,
      element_id: row.element_id,
      tracking_row_id: row.id,
    }));
    const expandedPlan = [root, sound, tp, pa];
    const expandedMatches = matchLegacyJobElements(rows, new Map(), expandedPlan, existingNodes);
    expect(expandedMatches.get(pa.key)?.element_id).toBe("remote-pa");

    const createRemote = vi.fn();
    await executeProvisioningPlan(expandedPlan, {
      load: async () => [...expandedMatches].map(([key, row]) => ({ key, state: "persisted", elementId: row.element_id, trackingRowId: row.id })),
      markCreating: async () => undefined,
      markRemoteElement: async () => undefined,
      persistTracking: async () => undefined,
      markPersisted: async () => undefined,
      markFailed: async () => undefined,
      markNeedsReconciliation: async () => undefined,
    }, createRemote);
    expect(createRemote).not.toHaveBeenCalled();
  });

  it("places tour dates below authoritative tour department roots", () => {
    const plan = buildJobPlan({ ...base, job: { id: "job-2", title: "Date", job_type: "tourdate" }, tour: { flex_sound_folder_id: "sound-root", flex_production_folder_id: "production-root", flex_personnel_folder_id: "personnel-root", flex_comercial_folder_id: "commercial-root", flex_estructura_folder_id: "estructura-root" } });
    expect(plan.find((node) => node.key === "department:sound")?.externalParentElementId).toBe("sound-root");
    expect(plan.find((node) => node.key === "department:estructura")?.externalParentElementId).toBe("estructura-root");
    expect(plan.some((node) => node.key === "root")).toBe(false);
  });
});
