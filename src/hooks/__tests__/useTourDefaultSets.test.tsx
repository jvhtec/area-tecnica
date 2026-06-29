// @vitest-environment jsdom
import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import { createMockQueryBuilder, mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import type { TourDefaultSet, TourDefaultTable } from "@/hooks/useTourDefaultSets";

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { useTourDefaultSets } from "@/hooks/useTourDefaultSets";

const createWrapper = () => {
  const queryClient = createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const createSet = (overrides: Partial<TourDefaultSet> = {}): TourDefaultSet => ({
  id: "set-1",
  tour_id: "tour-1",
  name: "Main",
  description: "Main package",
  department: "sound",
  package_size: "m",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const createTable = (overrides: Partial<TourDefaultTable> = {}): TourDefaultTable => ({
  id: "table-1",
  set_id: "set-1",
  table_name: "Main power",
  table_data: {
    rows: [{ quantity: "1", componentId: "amp-1", watts: "1200", componentName: "Amp" }],
    safetyMargin: 10,
  },
  table_type: "power",
  total_value: 1200,
  metadata: {
    order_index: 1,
    current_per_phase: 5.2,
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("useTourDefaultSets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
  });

  it("duplicates a default set and preserves child table snapshots", async () => {
    const sourceSet = createSet();
    const sourceTable = createTable();
    const copiedSet = createSet({ id: "set-copy", name: "Main Copy" });

    const setQuery = createMockQueryBuilder<TourDefaultSet[]>({ data: [sourceSet], error: null });
    const tableQuery = createMockQueryBuilder<TourDefaultTable[]>({ data: [sourceTable], error: null });
    const insertSet = createMockQueryBuilder<TourDefaultSet>({ data: copiedSet, error: null });
    const insertTables = createMockQueryBuilder<null>({ data: null, error: null });

    const setBuilders = [setQuery, insertSet];
    const tableBuilders = [tableQuery, insertTables];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tour_default_sets") {
        return setBuilders.shift() ?? createMockQueryBuilder<TourDefaultSet[]>({ data: [sourceSet], error: null });
      }
      if (table === "tour_default_tables") {
        return tableBuilders.shift() ?? createMockQueryBuilder<TourDefaultTable[]>({ data: [sourceTable], error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourDefaultSets("tour-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.defaultTables).toHaveLength(1);
    });

    await act(async () => {
      await result.current.duplicateSet({ setId: "set-1", name: "Main Copy" });
    });

    expect(insertSet.insert).toHaveBeenCalledWith({
      tour_id: "tour-1",
      name: "Main Copy",
      description: "Main package",
      department: "sound",
      package_size: "m",
    });
    expect(insertTables.insert).toHaveBeenCalledWith([
      {
        set_id: "set-copy",
        table_name: "Main power",
        table_data: sourceTable.table_data,
        table_type: "power",
        total_value: 1200,
        metadata: sourceTable.metadata,
      },
    ]);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Default set duplicated successfully",
      }),
    );
  });

  it("shows the mutation error message when creating a default set fails", async () => {
    const insertError = new Error("duplicate package size");
    const setQuery = createMockQueryBuilder<TourDefaultSet[]>({ data: [], error: null });
    const insertSet = createMockQueryBuilder<null>({ data: null, error: insertError });
    const setBuilders = [setQuery, insertSet];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tour_default_sets") {
        return setBuilders.shift() ?? createMockQueryBuilder<TourDefaultSet[]>({ data: [], error: null });
      }
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useTourDefaultSets("tour-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(setQuery.order).toHaveBeenCalledWith("created_at", { ascending: true });
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.createSet({
          tour_id: "tour-1",
          name: "Main",
          description: null,
          department: "sound",
          package_size: "m",
        });
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBe(insertError);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        description: "duplicate package size",
        variant: "destructive",
      }),
    );
  });
});
