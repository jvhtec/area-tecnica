import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createFlexFolderMock,
  updateFlexElementHeaderMock,
  getDryhireParentFolderIdMock,
  insertMock,
} = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  updateFlexElementHeaderMock: vi.fn(),
  getDryhireParentFolderIdMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock("../api", () => ({
  createFlexFolder: createFlexFolderMock,
  updateFlexElementHeader: updateFlexElementHeaderMock,
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
      insertMock(this.table, _payload);
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
    updateFlexElementHeaderMock.mockReset();
    getDryhireParentFolderIdMock.mockReset();
    insertMock.mockReset();

    getDryhireParentFolderIdMock.mockResolvedValue("dryhire-month-parent");
    updateFlexElementHeaderMock.mockResolvedValue(undefined);
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
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      1,
      "dryhire-folder",
      "documentNumber",
      "250101S"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      2,
      "dryhire-folder",
      "plannedStartDate",
      "2025-01-01T11:00:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      3,
      "dryhire-folder",
      "plannedEndDate",
      "2025-01-01T19:00:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      4,
      "dryhire-presupuesto",
      "documentNumber",
      "250101SDH"
    );
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
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      1,
      "dryhire-folder-lights",
      "documentNumber",
      "250101L"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      4,
      "dryhire-presupuesto-lights",
      "documentNumber",
      "250101LDH"
    );
  });

  it("uses the job timezone when local date differs from UTC date", async () => {
    const job = {
      id: "job-boundary-dryhire",
      job_type: "dryhire",
      title: "Boundary Dryhire Job",
      start_time: "2026-03-31T22:30:00.000Z",
      end_time: "2026-04-01T00:45:00.000Z",
      timezone: "Europe/Madrid",
      job_departments: [{ department: "sound" }],
    };

    await createAllFoldersForJob(
      job,
      "1999-01-01T00:00:00.000Z",
      "1999-01-01T01:00:00.000Z",
      "990101"
    );

    const [dryhirePayload] = createFlexFolderMock.mock.calls[0];
    const [presupuestoPayload] = createFlexFolderMock.mock.calls[1];

    expect(getDryhireParentFolderIdMock).toHaveBeenCalledWith(2026, "sound", "04");
    expect(dryhirePayload.documentNumber).toBe("260401S");
    expect(presupuestoPayload.documentNumber).toBe("260401SDH");
    expect(dryhirePayload.plannedStartDate).toBe("2026-04-01T00:30:00.000Z");
    expect(dryhirePayload.plannedEndDate).toBe("2026-04-01T02:45:00.000Z");
    expect(presupuestoPayload.plannedStartDate).toBe(dryhirePayload.plannedStartDate);
    expect(presupuestoPayload.plannedEndDate).toBe(dryhirePayload.plannedEndDate);
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      1,
      "dryhire-folder",
      "documentNumber",
      "260401S"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      2,
      "dryhire-folder",
      "plannedStartDate",
      "2026-04-01T00:30:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      3,
      "dryhire-folder",
      "plannedEndDate",
      "2026-04-01T02:45:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      4,
      "dryhire-presupuesto",
      "documentNumber",
      "260401SDH"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      5,
      "dryhire-presupuesto",
      "plannedStartDate",
      "2026-04-01T00:30:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenNthCalledWith(
      6,
      "dryhire-presupuesto",
      "plannedEndDate",
      "2026-04-01T02:45:00.000Z"
    );
  });

  it("does not persist local folder rows when header enforcement fails", async () => {
    updateFlexElementHeaderMock.mockRejectedValueOnce(new Error("header update failed"));

    const job = {
      id: "job-header-failure-dryhire",
      job_type: "dryhire",
      title: "Header Failure Dryhire Job",
      start_time: "2025-01-01T10:00:00.000Z",
      end_time: "2025-01-01T18:00:00.000Z",
      job_departments: [{ department: "sound" }],
    };

    await expect(
      createAllFoldersForJob(
        job,
        "2025-01-01T10:00:00.000Z",
        "2025-01-01T18:00:00.000Z",
        "250101"
      )
    ).rejects.toThrow("header update failed");

    expect(insertMock).not.toHaveBeenCalled();
  });
});
