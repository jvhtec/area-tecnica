import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTourDate {
  id: string;
  date: string;
  location_id: string | null;
}

interface MockTour {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  tour_dates: MockTourDate[];
}

interface TourUpdate {
  filters: Record<string, unknown>;
  payload: unknown;
}

interface TestState {
  flexFolderInserts: unknown[];
  tourUpdates: TourUpdate[];
  tour: MockTour | null;
}

interface FlexFolderMockResponse {
  elementId: string;
  elementNumber: string;
}

const { createFlexFolderMock, functionInvokeMock, state } = vi.hoisted(() => {
  const state: TestState = {
    flexFolderInserts: [],
    tourUpdates: [],
    tour: null,
  };

  return {
    createFlexFolderMock:
      vi.fn<(payload: Record<string, unknown>) => Promise<FlexFolderMockResponse>>(),
    functionInvokeMock: vi.fn<() => Promise<unknown>>(),
    state,
  };
});

vi.mock("@/utils/flex-folders/api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/lib/supabase", () => {
  type SupabaseResult<T> = Promise<{ data: T; error: unknown }>;

  type QueryAction = "select" | "insert" | "update";

  class MockQueryBuilder {
    private table: string;
    private action: QueryAction | null = null;
    private payload: unknown = null;
    private filters: Record<string, unknown> = {};

    constructor(table: string) {
      this.table = table;
    }

    select(_columns?: string) {
      this.action = "select";
      return this;
    }

    insert(payload: unknown) {
      this.action = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: unknown) {
      this.action = "update";
      this.payload = payload;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value;
      return this;
    }

    single() {
      return this;
    }

    private async execute(): SupabaseResult<unknown> {
      if (this.table === "tours" && this.action === "select") {
        return { data: state.tour, error: state.tour ? null : { message: "not found" } };
      }

      if (this.table === "tours" && this.action === "update") {
        state.tourUpdates.push({
          filters: { ...this.filters },
          payload: this.payload,
        });
        return { data: null, error: null };
      }

      if (this.table === "flex_folders" && this.action === "insert") {
        state.flexFolderInserts.push(this.payload);
        return { data: null, error: null };
      }

      return { data: null, error: null };
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  return {
    supabase: {
      from: (table: string) => new MockQueryBuilder(table),
      functions: {
        invoke: functionInvokeMock,
      },
    },
  };
});

import { createTourRootFoldersManual } from "../tourFolders";

describe("createTourRootFoldersManual", () => {
  beforeEach(() => {
    createFlexFolderMock.mockReset();
    functionInvokeMock.mockReset();
    state.flexFolderInserts = [];
    state.tourUpdates = [];
    state.tour = {
      id: "tour-1",
      name: "Kase-O",
      start_date: null,
      end_date: null,
      tour_dates: [
        { id: "date-2", date: "2026-08-05", location_id: null },
        { id: "date-1", date: "2026-08-01", location_id: null },
      ],
    };

    let counter = 0;
    createFlexFolderMock.mockImplementation(async () => ({
      elementId: `flex-${counter}`,
      elementNumber: `F-${counter++}`,
    }));
  });

  it("creates folders through the shared Flex API helper instead of invoking the proxy with a legacy payload", async () => {
    const result = await createTourRootFoldersManual("tour-1");

    expect(result.success).toBe(true);
    expect(functionInvokeMock).not.toHaveBeenCalled();
    expect(createFlexFolderMock).toHaveBeenCalled();

    const [mainPayload] = createFlexFolderMock.mock.calls[0];
    expect(mainPayload).toMatchObject({
      name: "Kase-O",
      documentNumber: "260801",
      notes: "Manual folder creation from Web App",
    });
    expect(mainPayload).not.toHaveProperty("parentElementId");

    expect(state.tourUpdates).toHaveLength(1);
    expect(state.tourUpdates[0]).toMatchObject({
      filters: { id: "tour-1" },
      payload: {
        flex_main_folder_id: "flex-0",
        flex_main_folder_number: "F-0",
        flex_folders_created: true,
      },
    });
  });
});
