import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock, ensureTourEstructuraRootMock, testState } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  ensureTourEstructuraRootMock: vi.fn(),
  testState: {
    existingTourDateRows: [] as any[],
    insertedFlexFolders: [] as any[],
    selectedDepartments: [] as string[],
    tourEstructuraFolderId: "flex-estructura" as string | null,
  },
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/utils/flex-folders/tourEstructuraRoot", () => ({
  ensureTourEstructuraRoot: ensureTourEstructuraRootMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  type SupabaseResult<T> = Promise<{ data: T; error: unknown }>;

  type QueryAction = "select" | "insert";

  class MockQueryBuilder {
    private table: string;
    private action: QueryAction | null = null;
    private filters: Record<string, unknown> = {};
    private insertPayload: any = null;
    private wantsReturning = false;
    private wantsSingle = false;

    constructor(table: string) {
      this.table = table;
    }

    select(_columns?: string) {
      if (this.action === "insert") {
        this.wantsReturning = true;
      } else {
        this.action = "select";
      }
      return this;
    }

    insert(payload: any) {
      this.action = "insert";
      this.insertPayload = payload;
      return this;
    }

    eq(column: string, value: any) {
      this.filters[column] = value;
      return this;
    }

    limit(_count: number) {
      return this;
    }

    single() {
      this.wantsSingle = true;
      return this;
    }

    private async execute(): SupabaseResult<any> {
      if (this.action === "select") {
        if (this.table === "flex_folders") {
          if (this.filters["tour_date_id"] && this.filters["folder_type"] === "tourdate") {
            return { data: testState.existingTourDateRows, error: null };
          }

          if (this.filters["job_id"]) {
            return { data: [], error: null };
          }

          const elementId = this.filters["element_id"];
          if (elementId) {
            return {
              data: [
                {
                  id: `db-${elementId}`,
                  element_id: elementId,
                  parent_id: null,
                  folder_type: "department",
                  department: null,
                },
              ],
              error: null,
            };
          }

          return { data: [], error: null };
        }

        if (this.table === "jobs") {
          return {
            data: [{
              job_departments: testState.selectedDepartments.map((department) => ({ department })),
            }],
            error: null,
          };
        }

        if (this.table === "tours") {
          const row = {
            id: this.filters["id"] ?? "tour-1",
            name: "Test Tour",
            flex_main_folder_id: "flex-main",
            flex_estructura_folder_id: testState.tourEstructuraFolderId,
            flex_sound_folder_id: "flex-sound",
            flex_lights_folder_id: "flex-lights",
            flex_video_folder_id: "flex-video",
            flex_production_folder_id: "flex-production",
            flex_personnel_folder_id: "flex-personnel",
            flex_comercial_folder_id: "flex-comercial",
          };

          return this.wantsSingle
            ? { data: row, error: null }
            : { data: [row], error: null };
        }

        if (this.table === "tour_dates") {
          const row = { is_tour_pack_only: false };
          return this.wantsSingle
            ? { data: row, error: null }
            : { data: [row], error: null };
        }

        return { data: [], error: null };
      }

      if (this.action === "insert") {
        if (this.table === "flex_folders") {
          const payload = Array.isArray(this.insertPayload)
            ? this.insertPayload[0]
            : this.insertPayload;
          testState.insertedFlexFolders.push(payload);
        }

        if (this.table === "flex_folders" && this.wantsReturning) {
          const payload = Array.isArray(this.insertPayload)
            ? this.insertPayload[0]
            : this.insertPayload;
          const row = {
            id: `row-${payload?.department ?? "main"}`,
            ...payload,
          };

          return this.wantsSingle
            ? { data: row, error: null }
            : { data: [row], error: null };
        }

        return { data: null, error: null };
      }

      return { data: null, error: null };
    }

    then<TResult1 = any, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: any; error: unknown }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  const supabase = {
    from: (table: string) => new MockQueryBuilder(table),
  };

  return { supabase };
});

import { createAllFoldersForJob } from "../folders";

describe("createAllFoldersForJob tourdate location naming", () => {
  beforeEach(() => {
    createFlexFolderMock.mockReset();
    testState.existingTourDateRows = [];
    testState.insertedFlexFolders = [];
    testState.selectedDepartments = [];
    testState.tourEstructuraFolderId = "flex-estructura";
    ensureTourEstructuraRootMock.mockReset();
    ensureTourEstructuraRootMock.mockResolvedValue({
      elementId: "flex-estructura",
      trackingId: "db-flex-estructura",
    });

    let counter = 0;
    createFlexFolderMock.mockImplementation(async () => ({
      elementId: `element-${counter++}`,
    }));
  });

  it("uses job.location_data when job.location is missing", async () => {
    const job = {
      id: "job-1",
      tour_date_id: "tour-date-1",
      job_type: "tourdate",
      tour_id: "tour-1",
      title: "Test Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-01T12:00:00.000Z",
      location_data: { name: "Madrid", formatted_address: "Madrid, ES" },
    };

    await createAllFoldersForJob(
      job,
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T12:00:00.000Z",
      "250101",
      {
        production: { subfolders: [] },
        personnel: { subfolders: [] },
      }
    );

    const createdNames = createFlexFolderMock.mock.calls.map(([payload]) => payload?.name);

    expect(createdNames.some((name: unknown) => typeof name === "string" && name.includes("Madrid"))).toBe(true);
    expect(createdNames.some((name: unknown) => typeof name === "string" && name.includes("No Location"))).toBe(false);

    const estructuraRows = testState.insertedFlexFolders.filter(
      (row) => row?.department === "estructura",
    );
    expect(estructuraRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ folder_type: "tourdate" }),
      expect.objectContaining({ folder_type: "pull_sheet", source_department: "sound" }),
      expect.objectContaining({ folder_type: "pull_sheet", source_department: "lights" }),
    ]));
    expect(estructuraRows).toHaveLength(3);
  });

  it("reuses existing tourdate department root by tour_date_id and does not create a duplicate", async () => {
    testState.existingTourDateRows = [
      {
        id: "row-existing-production",
        element_id: "existing-production-root",
        parent_id: "db-flex-production",
        folder_type: "tourdate",
        department: "production",
      },
    ];

    const job = {
      id: "job-2",
      tour_date_id: "tour-date-1",
      job_type: "tourdate",
      tour_id: "tour-1",
      title: "Tourdate Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-01T12:00:00.000Z",
      location_data: { name: "Madrid", formatted_address: "Madrid, ES" },
    };

    await createAllFoldersForJob(
      job,
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T12:00:00.000Z",
      "250101",
      {
        production: { subfolders: [] },
        personnel: { subfolders: [] },
      }
    );

    const createdRootParentIds = createFlexFolderMock.mock.calls
      .map(([payload]) => payload?.parentElementId)
      .filter((value: unknown): value is string => typeof value === "string");

    expect(createdRootParentIds).not.toContain("flex-production");

    const insertedProductionTourdateRoots = testState.insertedFlexFolders.filter(
      (row: any) => row?.department === "production" && row?.folder_type === "tourdate"
    );
    expect(insertedProductionTourdateRoots).toHaveLength(0);
  });

  it("repairs a missing tour Estructura root before creating any selected tour-date folders", async () => {
    testState.tourEstructuraFolderId = null;
    testState.selectedDepartments = ["sound", "lights", "video"];

    await expect(createAllFoldersForJob(
      {
        id: "job-legacy-tourdate",
        tour_date_id: "tour-date-1",
        job_type: "tourdate",
        tour_id: "tour-1",
        title: "Legacy tour date",
        start_time: "2025-01-01T10:00:00.000Z",
        end_time: "2025-01-01T12:00:00.000Z",
        location_data: { name: "Madrid", formatted_address: "Madrid, ES" },
      },
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T12:00:00.000Z",
      "250101",
      {
        sound: { subfolders: [] },
        lights: { subfolders: [] },
        video: { subfolders: [] },
        production: { subfolders: [] },
        personnel: { subfolders: [] },
        comercial: { subfolders: [] },
      },
    )).resolves.toBeUndefined();

    expect(createFlexFolderMock).toHaveBeenCalled();
    expect(ensureTourEstructuraRootMock).toHaveBeenCalledWith("tour-1");
    const createdParentIds = createFlexFolderMock.mock.calls.map(([payload]) => payload?.parentElementId);
    expect(createdParentIds).toEqual(expect.arrayContaining([
      "flex-estructura",
      "flex-sound",
      "flex-lights",
      "flex-video",
      "flex-production",
      "flex-personnel",
      "flex-comercial",
    ]));
  });
});
