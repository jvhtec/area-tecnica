import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock, invokeMock } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  invokeMock: vi.fn(),
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  type SupabaseResult<T> = Promise<{ data: T; error: unknown }>;

  type QueryAction = "select" | "insert" | "update";

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

    update(payload: unknown) {
      this.action = "update";
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

    maybeSingle() {
      this.wantsSingle = true;
      return this;
    }

    private async execute(): SupabaseResult<any> {
      if (this.action === "select") {
        if (this.table === "flex_folders") {
          return { data: [], error: null };
        }

        if (this.table === "job_departments") {
          const department = this.filters["job_id"] ? "sound" : "sound";
          return { data: [{ department }], error: null };
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

      if (this.action === "update") return { data: null, error: null };

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
    functions: { invoke: invokeMock },
  };

  return { supabase };
});

import { createAllFoldersForJob } from "../folders";

describe("createAllFoldersForJob folder picker options", () => {
  const forbiddenHojaDefinitionIds = [
    "702029c3-ba89-4304-98fe-fbc6fc695eb0",
    "4db54bad-b5fa-4c1f-85d4-525d991d7b62",
    "484249f0-6307-47a3-a782-6352ee5ef493",
  ];

  beforeEach(() => {
    createFlexFolderMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    let counter = 0;
    createFlexFolderMock.mockImplementation(async () => ({
      elementId: `element-${counter++}`,
    }));
  });

  it("only creates explicitly selected items when options omit other departments", async () => {
    const job = {
      id: "job-1",
      job_type: "single",
      title: "Test Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-02T10:00:00.000Z",
    };

    await createAllFoldersForJob(
      job,
      "2025-01-01T10:00:00.000Z",
      "2025-01-02T10:00:00.000Z",
      "250101",
      { sound: { subfolders: ["documentacionTecnica"] } }
    );

    expect(invokeMock).toHaveBeenCalledWith("create-flex-folders", { body: {
      operation: "job", jobId: "job-1",
      options: { sound: { subfolders: ["documentacionTecnica"] } },
    } });
    expect(createFlexFolderMock).not.toHaveBeenCalled();
  });

  it.each([
    ["default options", undefined],
    ["explicit empty selection", { sound: { subfolders: [] } }],
    ["stale Hoja selection", { sound: { subfolders: ["hojaInfo"] } }],
  ])("never creates deprecated Hoja elements with %s", async (_label, options) => {
    await createAllFoldersForJob(
      {
        id: "job-no-hoja",
        job_type: "single",
        title: "Trabajo sin Hoja",
        start_time: "2026-09-08T10:00:00.000Z",
        end_time: "2026-09-08T20:00:00.000Z",
      },
      "2026-09-08T10:00:00.000Z",
      "2026-09-08T20:00:00.000Z",
      "260908",
      options as never,
    );

    const request = JSON.stringify(invokeMock.mock.calls.at(-1));
    for (const definitionId of forbiddenHojaDefinitionIds) expect(request).not.toContain(definitionId);
    expect(request).not.toContain("hojaInfo");
    expect(createFlexFolderMock).not.toHaveBeenCalled();
  });
});
