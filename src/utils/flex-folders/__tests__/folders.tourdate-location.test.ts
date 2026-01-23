import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("Unexpected use of integrations supabase client in test");
    },
  },
}));

vi.mock("@/lib/supabase", () => {
  type SupabaseResult<T> = Promise<{ data: T; error: any }>;

  type QueryAction = "select" | "insert";

  class MockQueryBuilder {
    private table: string;
    private action: QueryAction | null = null;
    private filters: Record<string, any> = {};
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
            data: [{ job_departments: [] }],
            error: null,
          };
        }

        if (this.table === "tours") {
          const row = {
            id: this.filters["id"] ?? "tour-1",
            name: "Test Tour",
            flex_main_folder_id: "flex-main",
            flex_sound_folder_id: "flex-sound",
            flex_lights_folder_id: "flex-lights",
            flex_video_folder_id: "flex-video",
            flex_production_folder_id: "flex-production",
            flex_personnel_folder_id: "flex-personnel",
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
        | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
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
    let counter = 0;
    createFlexFolderMock.mockImplementation(async () => ({
      elementId: `element-${counter++}`,
    }));
  });

  it("uses job.location_data when job.location is missing", async () => {
    const job = {
      id: "job-1",
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
  });
});
