import { beforeEach, describe, expect, it, vi } from "vitest";

const { getElementTreeMock, updateFlexElementHeaderMock, testState } = vi.hoisted(() => ({
  getElementTreeMock: vi.fn(),
  updateFlexElementHeaderMock: vi.fn(),
  testState: {
    job: {
      title: "New Job",
      job_type: "single",
      timezone: "Europe/Madrid",
      location: { name: "Madrid" },
    },
    folders: [
      {
        element_id: "main-folder",
        department: null,
        folder_type: "main_event",
        parent_id: null,
      },
      {
        element_id: "sound-folder",
        department: "sound",
        folder_type: "department",
        parent_id: "main-folder",
      },
    ],
    crewCalls: [
      {
        flex_element_id: "sound-crew-call",
        department: "sound",
      },
    ],
    crewCallsError: null as { message: string } | null,
  },
}));

vi.mock("@/utils/flex-folders/api", () => ({
  updateFlexElementHeader: updateFlexElementHeaderMock,
}));

vi.mock("@/utils/flex-folders/getElementTree", () => ({
  getElementTree: getElementTreeMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  type SupabaseResponse<T> = { data: T; error: { message: string } | null };
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

      if (this.table === "flex_crew_calls") {
        return {
          data: testState.crewCallsError ? null : testState.crewCalls,
          error: testState.crewCallsError,
        };
      }

      throw new Error(`Unexpected table in standard sync test: ${this.table}`);
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
  haveJobDatesChanged,
  syncFlexElementsForJobDateChange,
} from "@/utils/flex-folders/syncDateChange";

describe("syncFlexElementsForJobDateChange standard jobs", () => {
  beforeEach(() => {
    testState.crewCallsError = null;
    updateFlexElementHeaderMock.mockReset();
    updateFlexElementHeaderMock.mockResolvedValue(undefined);
    getElementTreeMock.mockReset();
    getElementTreeMock.mockImplementation((elementId: string) => {
      if (elementId !== "main-folder") {
        throw new Error(`Duplicate subtree traversal: ${elementId}`);
      }

      return Promise.resolve([
        {
          elementId: "main-folder",
          displayName: "Old Job",
          documentNumber: "260101",
          children: [
            {
              elementId: "sound-folder",
              displayName: "Old Job - Sound",
              documentNumber: "260101S",
            },
            {
              elementId: "sound-crew-call",
              displayName: "Crew Call Sonido - Old Job",
              documentNumber: "260101HRCCS",
            },
          ],
        },
      ]);
    });
  });

  it("treats equivalent UTC timestamp serializations as unchanged", () => {
    expect(
      haveJobDatesChanged(
        "2026-02-03T10:00:00+00:00",
        "2026-02-03T20:00:00+00:00",
        "2026-02-03T10:00:00.000Z",
        "2026-02-03T20:00:00.000Z"
      )
    ).toBe(false);
  });

  it("traverses the main tree once and updates each owned element once", async () => {
    const result = await syncFlexElementsForJobDateChange(
      "job-1",
      "2026-02-03T10:00:00.000Z",
      "2026-02-03T20:00:00.000Z",
      "New Job",
      "Old Job"
    );

    expect(result).toEqual({ success: 3, failed: 0, errors: [] });
    expect(getElementTreeMock).toHaveBeenCalledTimes(1);
    expect(getElementTreeMock).toHaveBeenCalledWith("main-folder");

    for (const elementId of ["main-folder", "sound-folder", "sound-crew-call"]) {
      expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
        elementId,
        "plannedStartDate",
        "2026-02-03T11:00:00.000Z"
      );
      expect(
        updateFlexElementHeaderMock.mock.calls.filter(
          ([calledElementId, field]) => calledElementId === elementId && field === "documentNumber"
        )
      ).toHaveLength(1);
    }

    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "main-folder",
      "name",
      "New Job"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "sound-folder",
      "name",
      "New Job - Sound"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "sound-crew-call",
      "name",
      "Crew Call Sonido - New Job"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "sound-crew-call",
      "documentNumber",
      "260203HRCCS"
    );
  });

  it("continues folder synchronization when the crew-call lookup fails", async () => {
    testState.crewCallsError = { message: "temporarily unavailable" };

    const result = await syncFlexElementsForJobDateChange(
      "job-1",
      "2026-02-03T10:00:00.000Z",
      "2026-02-03T20:00:00.000Z",
      "New Job",
      "Old Job"
    );

    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([
      "Failed to fetch Flex crew calls: temporarily unavailable",
    ]);
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "main-folder",
      "documentNumber",
      "260203"
    );
    expect(updateFlexElementHeaderMock).toHaveBeenCalledWith(
      "sound-folder",
      "documentNumber",
      "260203S"
    );
  });
});
