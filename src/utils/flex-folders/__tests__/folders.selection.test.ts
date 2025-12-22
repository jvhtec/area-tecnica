import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
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

describe("createAllFoldersForJob folder picker options", () => {
  beforeEach(() => {
    createFlexFolderMock.mockReset();
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

    const names = createFlexFolderMock.mock.calls.map(([payload]) => payload?.name);

    expect(names).toContain("Test Job - Documentación Técnica - Sound");
    expect(names.some((name: string) => name.includes(" - Documentación Técnica - Production"))).toBe(false);
    expect(names.some((name: string) => name.includes("Presupuestos Recibidos"))).toBe(false);
    expect(names.some((name: string) => name.includes("Hoja de Gastos"))).toBe(false);
    expect(names.some((name: string) => name.includes("Crew Call"))).toBe(false);
    expect(names.some((name: string) => name.includes("Orden de Trabajo"))).toBe(false);
    expect(names.some((name: string) => name.includes("Gastos de Personal"))).toBe(false);
    expect(names.some((name: string) => name.includes("Extras"))).toBe(false);
  });
});

