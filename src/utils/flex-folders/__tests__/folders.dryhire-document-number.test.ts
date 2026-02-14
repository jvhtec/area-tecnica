import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock, getDryhireParentFolderIdMock } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  getDryhireParentFolderIdMock: vi.fn(),
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("../dryhireFolderService", () => ({
  getDryhireParentFolderId: getDryhireParentFolderIdMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("Unexpected use of integrations supabase client in dryhire folder test");
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

    constructor(table: string) {
      this.table = table;
    }

    select(_columns?: string) {
      this.action = "select";
      return this;
    }

    insert(_payload: any) {
      this.action = "insert";
      return this;
    }

    eq(column: string, value: any) {
      this.filters[column] = value;
      return this;
    }

    private async execute(): SupabaseResult<any> {
      if (this.table !== "flex_folders") {
        throw new Error(`Unexpected table in test mock: ${this.table}`);
      }

      if (this.action === "select") {
        if (this.filters["job_id"]) {
          return { data: [], error: null };
        }
        return { data: [], error: null };
      }

      if (this.action === "insert") {
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

describe("createAllFoldersForJob dryhire document numbers", () => {
  beforeEach(() => {
    createFlexFolderMock.mockReset();
    getDryhireParentFolderIdMock.mockReset();

    getDryhireParentFolderIdMock.mockResolvedValue("dryhire-month-parent");
    createFlexFolderMock
      .mockResolvedValueOnce({ elementId: "dryhire-folder" })
      .mockResolvedValueOnce({ elementId: "dryhire-presupuesto" });
  });

  it("assigns distinct dryhire and presupuesto numbers for sound jobs", async () => {
    const job = {
      id: "job-sound-dryhire",
      job_type: "dryhire",
      title: "Sound Dryhire Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-01T18:00:00.000Z",
      job_departments: [{ department: "sound" }],
    };

    await createAllFoldersForJob(
      job,
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T18:00:00.000Z",
      "250101"
    );

    const [dryhirePayload] = createFlexFolderMock.mock.calls[0];
    const [presupuestoPayload] = createFlexFolderMock.mock.calls[1];

    expect(dryhirePayload.documentNumber).toBe("250101S");
    expect(presupuestoPayload.documentNumber).toBe("250101SDH");
  });

  it("assigns distinct dryhire and presupuesto numbers for lights jobs", async () => {
    createFlexFolderMock.mockReset();
    createFlexFolderMock
      .mockResolvedValueOnce({ elementId: "dryhire-folder-lights" })
      .mockResolvedValueOnce({ elementId: "dryhire-presupuesto-lights" });

    const job = {
      id: "job-lights-dryhire",
      job_type: "dryhire",
      title: "Lights Dryhire Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-01T18:00:00.000Z",
      job_departments: [{ department: "lights" }],
    };

    await createAllFoldersForJob(
      job,
      "2025-01-01T10:00:00.000Z",
      "2025-01-01T18:00:00.000Z",
      "250101"
    );

    const [dryhirePayload] = createFlexFolderMock.mock.calls[0];
    const [presupuestoPayload] = createFlexFolderMock.mock.calls[1];

    expect(dryhirePayload.documentNumber).toBe("250101L");
    expect(presupuestoPayload.documentNumber).toBe("250101LDH");
  });
});
