import { beforeEach, describe, expect, it, vi } from "vitest";

const { getElementTreeMock, updateFlexElementHeaderMock, testState } = vi.hoisted(() => ({
  getElementTreeMock: vi.fn(),
  updateFlexElementHeaderMock: vi.fn(),
  testState: {
    job: {
      title: "Loquillo - Mallorca",
      job_type: "tourdate",
      timezone: "Europe/Madrid",
      location: { name: "Mallorca" },
    },
    tourDate: {
      location: { name: "Mallorca" },
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

      if (this.table === "tour_dates" && this.singleResult) {
        return { data: testState.tourDate, error: null };
      }

      if (this.table === "flex_folders") {
        return { data: testState.folders, error: null };
      }

      throw new Error(`Unexpected table in tourdate sync test: ${this.table}`);
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

import {
  syncFlexElementsForJobDateChange,
  syncFlexElementsForTourDateChange,
} from "@/utils/flex-folders/syncDateChange";

describe("syncFlexElementsForTourDateChange scoping", () => {
  beforeEach(() => {
    updateFlexElementHeaderMock.mockReset();
    getElementTreeMock.mockReset();
    updateFlexElementHeaderMock.mockResolvedValue(undefined);
    testState.job = {
      title: "Loquillo - Mallorca",
      job_type: "tourdate",
      timezone: "Europe/Madrid",
      location: { name: "Mallorca" },
    };
    testState.tourDate = {
      location: { name: "Mallorca" },
    };
    testState.folders = [
      {
        element_id: "tourdate-sound-folder",
        department: "sound",
        folder_type: "tourdate",
      },
      {
        element_id: "tourdate-sound-quote",
        department: "sound",
        folder_type: "presupuestos_recibidos",
      },
    ];

    getElementTreeMock.mockImplementation((elementId: string) => {
      if (elementId === "tourdate-sound-folder") {
        return Promise.resolve([
          {
            elementId: "tourdate-sound-folder",
            displayName: "Mallorca - Old Date - Sound",
            documentNumber: "260502S",
            children: [
              {
                elementId: "unrelated-tour-child",
                displayName: "Unrelated Tour Child",
                documentNumber: "260502BAD",
              },
            ],
          },
        ]);
      }

      if (elementId === "tourdate-sound-quote") {
        return Promise.resolve([
          {
            elementId: "tourdate-sound-quote",
            displayName: "Old Quote",
            documentNumber: "260502SPR",
            children: [
              {
                elementId: "unrelated-nested-quote-child",
                displayName: "Unrelated Nested Quote Child",
                documentNumber: "260502BAD",
              },
            ],
          },
        ]);
      }

      return Promise.reject(new Error(`Unexpected tree lookup: ${elementId}`));
    });
  });

  it("updates only recorded tour date elements and leaves nested tree elements untouched", async () => {
    const result = await syncFlexElementsForTourDateChange(
      "tour-date-1",
      "2026-06-03T00:00:00.000Z"
    );

    expect(result).toEqual({ success: 2, failed: 0, errors: [] });
    expect(getElementTreeMock).toHaveBeenCalledTimes(2);
    expect(getElementTreeMock).toHaveBeenCalledWith("tourdate-sound-folder");
    expect(getElementTreeMock).toHaveBeenCalledWith("tourdate-sound-quote");
    expect(updateFlexElementHeaderMock).toHaveBeenCalledTimes(7);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "documentNumber",
      "260603S"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-quote",
      "documentNumber",
      "260603SPR"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "plannedStartDate",
      "2026-06-03T02:00:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-quote",
      "plannedEndDate",
      "2026-06-03T02:00:00.000Z"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "name",
      "Mallorca - Jun 3, 2026 - Sound"
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "unrelated-tour-child",
      expect.any(String),
      expect.any(String)
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "unrelated-nested-quote-child",
      expect.any(String),
      expect.any(String)
    );
  });

  it("handles Flex trees that omit the queried root element", async () => {
    testState.folders = [
      {
        element_id: "tourdate-sound-folder",
        department: "sound",
        folder_type: "tourdate",
      },
    ];
    getElementTreeMock.mockResolvedValue([
      {
        elementId: "child-only-response",
        displayName: "Child Only",
        documentNumber: "260502BAD",
      },
    ]);

    const result = await syncFlexElementsForTourDateChange(
      "tour-date-1",
      "2026-06-03T00:00:00.000Z"
    );

    expect(result).toEqual({ success: 1, failed: 0, errors: [] });
    expect(updateFlexElementHeaderMock).toHaveBeenCalledTimes(4);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "documentNumber",
      "260603"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "name",
      "Mallorca - Jun 3, 2026 - Sound"
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "child-only-response",
      expect.any(String),
      expect.any(String)
    );
  });

  it("keeps tour date job date sync scoped to recorded rows too", async () => {
    const result = await syncFlexElementsForJobDateChange(
      "job-1",
      "2026-06-03T00:00:00.000Z",
      "2026-06-03T21:59:00.000Z"
    );

    expect(result).toEqual({ success: 2, failed: 0, errors: [] });
    expect(getElementTreeMock).toHaveBeenCalledTimes(2);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledTimes(8);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "documentNumber",
      "260603S"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-quote",
      "documentNumber",
      "260603SPR"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-folder",
      "name",
      "Mallorca - Jun 3, 2026 - Sound"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "tourdate-sound-quote",
      "name",
      "Loquillo - Mallorca - Presupuestos Recibidos - Sound"
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "unrelated-tour-child",
      expect.any(String),
      expect.any(String)
    );
    expect(updateFlexElementHeaderMock).not.toHaveBeenCalledWith(
      "unrelated-nested-quote-child",
      expect.any(String),
      expect.any(String)
    );
  });
});
