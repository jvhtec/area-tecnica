import { beforeEach, describe, expect, it, vi } from "vitest";

const { createFlexFolderMock, state } = vi.hoisted(() => ({
  createFlexFolderMock: vi.fn(),
  state: {
    inserts: [] as Array<Record<string, unknown>>,
    rows: [] as Array<Record<string, unknown>>,
    tour: null as Record<string, unknown> | null,
    updates: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock("@/utils/flex-folders/api", () => ({
  createFlexFolder: createFlexFolderMock,
}));

vi.mock("@/integrations/supabase/client", () => {
  type Action = "insert" | "select" | "update";

  class QueryBuilder {
    private action: Action = "select";
    private filters: Record<string, unknown> = {};
    private payload: Record<string, unknown> = {};

    constructor(private readonly table: string) {}

    select() {
      return this;
    }

    insert(payload: Record<string, unknown>) {
      this.action = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.action = "update";
      this.payload = payload;
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters[column] = value;
      return this;
    }

    limit() {
      return this;
    }

    single() {
      return this;
    }

    private async execute(): Promise<{ data: unknown; error: unknown }> {
      if (this.table === "tours" && this.action === "select") {
        return { data: state.tour, error: null as unknown };
      }

      if (this.table === "tours" && this.action === "update") {
        state.updates.push(this.payload);
        state.tour = { ...state.tour, ...this.payload };
        return { data: this.payload, error: null };
      }

      if (this.table === "flex_folders" && this.action === "select") {
        const rows = state.rows.filter((row) =>
          Object.entries(this.filters).every(([key, value]) => row[key] === value)
        );
        return { data: rows, error: null };
      }

      if (this.table === "flex_folders" && this.action === "insert") {
        const row = { id: `tracking-${state.rows.length + 1}`, ...this.payload };
        state.inserts.push(this.payload);
        state.rows.push(row);
        return { data: row, error: null };
      }

      return { data: null, error: null };
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: Awaited<ReturnType<QueryBuilder["execute"]>>) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }
  }

  return {
    supabase: {
      from: (table: string) => new QueryBuilder(table),
    },
  };
});

import { ensureTourEstructuraRoot } from "@/utils/flex-folders/tourEstructuraRoot";

describe("ensureTourEstructuraRoot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inserts = [];
    state.rows = [];
    state.updates = [];
    state.tour = {
      id: "tour-1",
      name: "Legacy Tour",
      start_date: null,
      end_date: null,
      flex_main_folder_id: "main-element",
      flex_estructura_folder_id: null,
      tour_dates: [{ date: "2026-09-12" }, { date: "2026-09-20" }],
    };
    createFlexFolderMock.mockResolvedValue({ elementId: "estructura-element" });
  });

  it("creates, persists, and tracks a missing Estructura root", async () => {
    await expect(ensureTourEstructuraRoot("tour-1")).resolves.toEqual({
      elementId: "estructura-element",
      trackingId: "tracking-1",
    });

    expect(createFlexFolderMock).toHaveBeenCalledWith(expect.objectContaining({
      parentElementId: "main-element",
      name: "Legacy Tour - Estructura",
      departmentId: expect.any(String),
      documentNumber: "260912E",
    }));
    expect(state.updates).toEqual([{ flex_estructura_folder_id: "estructura-element" }]);
    expect(state.inserts).toEqual([expect.objectContaining({
      parent_id: "main-element",
      element_id: "estructura-element",
      department: "estructura",
      folder_type: "tour_department",
    })]);
  });

  it("adopts an already tracked root instead of creating a duplicate", async () => {
    state.rows = [{
      id: "tracking-existing",
      parent_id: "main-element",
      element_id: "estructura-existing",
      department: "estructura",
      folder_type: "tour_department",
    }];

    await expect(ensureTourEstructuraRoot("tour-1")).resolves.toEqual({
      elementId: "estructura-existing",
      trackingId: "tracking-existing",
    });

    expect(createFlexFolderMock).not.toHaveBeenCalled();
    expect(state.updates).toEqual([{ flex_estructura_folder_id: "estructura-existing" }]);
  });

  it("backfills tracking when the tour already stores the Flex element", async () => {
    state.tour = { ...state.tour, flex_estructura_folder_id: "estructura-existing" };

    await expect(ensureTourEstructuraRoot("tour-1")).resolves.toEqual({
      elementId: "estructura-existing",
      trackingId: "tracking-1",
    });

    expect(createFlexFolderMock).not.toHaveBeenCalled();
    expect(state.updates).toEqual([]);
    expect(state.inserts).toHaveLength(1);
  });
});
