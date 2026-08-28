import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFlexFolder: vi.fn(),
  inserted: [] as Record<string, unknown>[],
}));

vi.mock("../api", () => ({ createFlexFolder: mocks.createFlexFolder }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert(payload: Record<string, unknown>) {
        mocks.inserted.push(payload);
        return {
          select: () => ({
            single: async () => ({
              data: {
                id: `row-${mocks.inserted.length}`,
                parent_id: payload.parent_id ?? null,
                element_id: payload.element_id,
                folder_type: payload.folder_type,
                department: payload.department,
                source_department: payload.source_department ?? null,
              },
              error: null as Error | null,
            }),
          }),
        };
      },
    }),
  },
}));

import { ensureEstructuraFolders } from "../folder-creation/createEstructuraFolders";
import { RESPONSIBLE_PERSON_IDS } from "../constants";

describe("ensureEstructuraFolders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserted.length = 0;
    let counter = 0;
    mocks.createFlexFolder.mockImplementation(async () => ({ elementId: `flex-${counter++}` }));
  });

  it("creates one operational folder and exactly two source-discriminated pull sheets", async () => {
    const pullsheets = new Map();
    const department = await ensureEstructuraFolders({
      jobId: "job-1",
      parentElementId: "main-flex",
      parentTrackingId: "main-row",
      existingPullSheets: pullsheets,
      departmentFolderName: "Trabajo - Estructura",
      pullSheetNamePrefix: "Trabajo",
      documentNumber: "260828",
      plannedStartDate: "2026-08-28T08:00:00.000Z",
      plannedEndDate: "2026-08-29T02:00:00.000Z",
    });

    expect(department.department).toBe("estructura");
    expect(mocks.createFlexFolder).toHaveBeenCalledTimes(3);
    expect(mocks.createFlexFolder).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "Trabajo - Estructura Sonido",
        documentNumber: "260828ES",
        personResponsibleId: RESPONSIBLE_PERSON_IDS.sound,
      }),
    );
    expect(mocks.createFlexFolder).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: "Trabajo - Estructura Luces",
        documentNumber: "260828EL",
        personResponsibleId: RESPONSIBLE_PERSON_IDS.lights,
      }),
    );
    expect(mocks.inserted.filter((row) => row.folder_type === "pull_sheet")).toEqual([
      expect.objectContaining({ department: "estructura", source_department: "sound" }),
      expect.objectContaining({ department: "estructura", source_department: "lights" }),
    ]);

    await ensureEstructuraFolders({
      jobId: "job-1",
      parentElementId: "main-flex",
      parentTrackingId: "main-row",
      existingDepartmentFolder: department,
      existingPullSheets: pullsheets,
      departmentFolderName: "Trabajo - Estructura",
      pullSheetNamePrefix: "Trabajo",
      documentNumber: "260828",
      plannedStartDate: "2026-08-28T08:00:00.000Z",
      plannedEndDate: "2026-08-29T02:00:00.000Z",
    });

    expect(mocks.createFlexFolder).toHaveBeenCalledTimes(3);
  });
});
