import { beforeEach, describe, expect, it, vi } from "vitest";

const { getElementTreeMock, updateFlexElementHeaderMock, testState } = vi.hoisted(() => ({
  getElementTreeMock: vi.fn(),
  updateFlexElementHeaderMock: vi.fn(),
  testState: {
    job: {
      title: "Dry Hire - Alquiler AVL",
      job_type: "dryhire",
      timezone: "Europe/Madrid",
      location: { name: "Madrid" },
    },
    folders: [] as Array<{
      element_id: string;
      department: string | null;
      folder_type: string | null;
    }>,
  },
}));

vi.mock("@/utils/flex-folders/api", () => ({
  updateFlexElementHeader: updateFlexElementHeaderMock,
}));

vi.mock("@/utils/flex-folders/getElementTree", () => ({
  getElementTree: getElementTreeMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  type SupabaseResponse<T> = { data: T; error: null };
  type SupabaseResult<T> = Promise<SupabaseResponse<T>>;

  class MockQueryBuilder {
    private table: string;
    private singleResult = false;

    constructor(table: string) {
      this.table = table;
    }

    select(_columns?: string) {
      return this;
    }

    eq(_column: string, _value: unknown) {
      return this;
    }

    single() {
      this.singleResult = true;
      return this;
    }

    private async execute(): SupabaseResult<unknown> {
      if (this.table === "jobs" && this.singleResult) {
        return { data: testState.job, error: null };
      }

      if (this.table === "flex_folders") {
        return { data: testState.folders, error: null };
      }

      throw new Error(`Unexpected table in dryhire sync test: ${this.table}`);
    }

    then<TResult1 = SupabaseResponse<unknown>, TResult2 = never>(
      onfulfilled?:
        | ((value: SupabaseResponse<unknown>) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  return {
    supabase: {
      from: (table: string) => new MockQueryBuilder(table),
    },
  };
});

import { syncFlexElementsForJobDateChange } from "../syncDateChange";

describe("syncFlexElementsForJobDateChange dryhire scoping", () => {
  beforeEach(() => {
    updateFlexElementHeaderMock.mockReset();
    getElementTreeMock.mockReset();
    getElementTreeMock.mockResolvedValue([
      {
        elementId: "shared-month-parent",
        documentNumber: "666.26.04",
        children: [
          { elementId: "other-dryhire-folder", documentNumber: "260401S" },
          { elementId: "another-dryhire-folder", documentNumber: "260402S" },
        ],
      },
    ]);
    updateFlexElementHeaderMock.mockResolvedValue(undefined);
    testState.job = {
      title: "Dry Hire - Alquiler AVL",
      job_type: "dryhire",
      timezone: "Europe/Madrid",
      location: { name: "Madrid" },
    };
    testState.folders = [
      {
        element_id: "job-dryhire-folder",
        department: "sound",
        folder_type: "dryhire",
      },
      {
        element_id: "job-dryhire-presupuesto",
        department: "sound",
        folder_type: "dryhire_presupuesto",
      },
    ];
  });

  it("updates only recorded dryhire elements and does not traverse shared Flex trees", async () => {
    const result = await syncFlexElementsForJobDateChange(
      "job-1",
      "2026-04-14T22:30:00.000Z",
      "2026-04-15T01:00:00.000Z"
    );

    expect(result).toEqual({ success: 2, failed: 0, errors: [] });
    expect(getElementTreeMock).not.toHaveBeenCalled();
    expect(updateFlexElementHeaderMock).toHaveBeenCalledTimes(6);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-folder",
      "documentNumber",
      "260415S"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-presupuesto",
      "documentNumber",
      "260415SDH"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-folder",
      "plannedStartDate",
      "2026-04-15T00:30:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-presupuesto",
      "plannedEndDate",
      "2026-04-15T03:00:00.000Z"
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "other-dryhire-folder",
      expect.any(String),
      expect.any(String)
    );
  });

  it("updates dryhire names when the job title changes without touching siblings", async () => {
    const result = await syncFlexElementsForJobDateChange(
      "job-1",
      "2026-04-15T10:00:00.000Z",
      "2026-04-15T18:00:00.000Z",
      "Updated Dryhire"
    );

    expect(result).toEqual({ success: 2, failed: 0, errors: [] });
    expect(getElementTreeMock).not.toHaveBeenCalled();
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-folder",
      "name",
      "Dry Hire - Updated Dryhire"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "job-dryhire-presupuesto",
      "name",
      "Dry Hire - Updated Dryhire"
    );
  });
});
