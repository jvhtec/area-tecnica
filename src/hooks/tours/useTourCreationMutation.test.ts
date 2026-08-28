import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEPARTMENT_IDS, FLEX_FOLDER_IDS } from "@/utils/flex-folders/constants";

const testState = vi.hoisted(() => ({
  flexPayloads: [] as Array<Record<string, unknown>>,
  flexFolderRows: [] as Array<Record<string, unknown>>,
  tourUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/hooks/useLocationManagement", () => ({
  useLocationManagement: () => ({
    getOrCreateLocation: vi.fn().mockResolvedValue("location-1"),
  }),
}));

vi.mock("@/utils/flex-folders/api", () => ({
  createFlexFolder: vi.fn(async (payload: Record<string, unknown>) => {
    testState.flexPayloads.push(payload);
    const sequence = testState.flexPayloads.length;
    return { elementId: `element-${sequence}`, elementNumber: `number-${sequence}` };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: vi.fn((table: string) => ({
      insert: (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
        if (table === "tours") {
          return {
            select: () => ({
              single: async (): Promise<{ data: { id: string; name: string }; error: null }> => ({
                data: { id: "tour-1", name: "Test Tour" }, error: null,
              }),
            }),
          };
        }
        if (table === "tour_dates") {
          return {
            select: () => ({
              single: async (): Promise<{ data: { id: string; date: string }; error: null }> => ({
                data: { id: "tour-date-1", date: "2026-08-30" }, error: null,
              }),
            }),
          };
        }
        if (table === "jobs") {
          return {
            select: () => ({
              single: async (): Promise<{ data: { id: string }; error: null }> => ({
                data: { id: "job-1" }, error: null,
              }),
            }),
          };
        }
        if (table === "flex_folders") {
          testState.flexFolderRows.push(payload as Record<string, unknown>);
        }
        return Promise.resolve({ error: null });
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async (): Promise<{ error: null }> => {
          if (table === "tours") testState.tourUpdates.push(payload);
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (): Promise<{ error: null }> => ({ error: null }),
      }),
    })),
  },
}));

import { useTourCreationMutation } from "./useTourCreationMutation";

describe("useTourCreationMutation Estructura hierarchy", () => {
  beforeEach(() => {
    testState.flexPayloads.length = 0;
    testState.flexFolderRows.length = 0;
    testState.tourUpdates.length = 0;
  });

  it("always creates and tracks the non-selectable Estructura tour root", async () => {
    const { createTourWithDates } = useTourCreationMutation();

    await createTourWithDates({
      title: "Test Tour",
      description: "",
      dates: [{ date: "2026-08-30", location: "Madrid" }],
      color: "#000000",
      departments: ["sound"],
    });

    const estructuraPayloadIndex = testState.flexPayloads.findIndex(
      (payload) => payload.departmentId === DEPARTMENT_IDS.estructura,
    );
    expect(estructuraPayloadIndex).toBeGreaterThan(0);
    expect(testState.flexPayloads[estructuraPayloadIndex]).toEqual(expect.objectContaining({
      parentElementId: "element-1",
      personResponsibleId: FLEX_FOLDER_IDS.mainResponsible,
    }));
    expect(testState.flexFolderRows).toContainEqual(expect.objectContaining({
      department: "estructura",
      folder_type: "tour_department",
    }));
    expect(testState.tourUpdates).toContainEqual(expect.objectContaining({
      flex_estructura_folder_id: `element-${estructuraPayloadIndex + 1}`,
    }));
  });
});
