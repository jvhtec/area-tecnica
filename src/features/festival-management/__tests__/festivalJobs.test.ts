import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryState, useOptimizedRealtimeMock, useQueryMock } = vi.hoisted(
  () => ({
    queryState: {
      data: [] as Array<Record<string, unknown>>,
      error: null as unknown,
      calls: [] as Array<[string, unknown]>,
    },
    useOptimizedRealtimeMock: vi.fn(),
    useQueryMock: vi.fn(() => ({ data: [] })),
  }),
);

vi.mock("@tanstack/react-query", () => ({ useQuery: useQueryMock }));

vi.mock("@/hooks/useOptimizedRealtime", () => ({
  useOptimizedRealtime: useOptimizedRealtimeMock,
}));

vi.mock("@/services/dataLayerClient", () => ({
  dataLayerClient: {
    from: vi.fn((table: string) => {
      queryState.calls.push(["from", table]);
      const builder = {
        in: vi.fn((column: string, values: string[]) => {
          queryState.calls.push(["in", { column, values }]);
          return builder;
        }),
        order: vi.fn(async (column: string, options: unknown) => {
          queryState.calls.push(["order", { column, options }]);
          return { data: queryState.data, error: queryState.error };
        }),
        select: vi.fn((columns: string) => {
          queryState.calls.push(["select", columns]);
          return builder;
        }),
      };
      return builder;
    }),
  },
}));

import { fetchFestivalJobs, useFestivalJobs } from "../festivalJobs";

const festivalRow = {
  id: "festival-1",
  title: "Festival Salseo",
  description: null,
  start_time: "2031-07-10T08:00:00Z",
  end_time: "2031-07-11T02:00:00Z",
  created_at: "2030-01-01T00:00:00Z",
  job_type: "festival",
  status: null,
  color: null,
};

describe("fetchFestivalJobs", () => {
  beforeEach(() => {
    queryState.data = [festivalRow];
    queryState.error = null;
    queryState.calls = [];
    useOptimizedRealtimeMock.mockClear();
    useQueryMock.mockClear();
  });

  it("returns Festival Salseo without depending on unrelated joined data", async () => {
    await expect(fetchFestivalJobs(false)).resolves.toEqual([festivalRow]);

    expect(queryState.calls).toContainEqual([
      "in",
      { column: "job_type", values: ["festival", "ciclo"] },
    ]);
    const selectedColumns = queryState.calls.find(
      ([method]) => method === "select",
    )?.[1];
    expect(selectedColumns).not.toContain("job_departments");
    expect(queryState.calls.some(([method]) => method === "neq")).toBe(false);
  });

  it("filters cancelled and completed rows while preserving null statuses", async () => {
    queryState.data = [
      festivalRow,
      { ...festivalRow, id: "completed", status: "Completado" },
      { ...festivalRow, id: "cancelled", status: "Cancelado" },
    ];

    await expect(fetchFestivalJobs(false)).resolves.toEqual([festivalRow]);
    await expect(fetchFestivalJobs(true)).resolves.toEqual([
      festivalRow,
      { ...festivalRow, id: "completed", status: "Completado" },
    ]);
  });

  it("registers realtime invalidation for the dedicated festival cache", () => {
    useFestivalJobs(false);

    expect(useOptimizedRealtimeMock).toHaveBeenCalledWith(
      "jobs",
      ["jobs", "festival-list"],
      { priority: "high" },
    );
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["jobs", "festival-list", "active"],
      }),
    );
  });
});
