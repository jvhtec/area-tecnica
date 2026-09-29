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
        or: vi.fn((filter: string) => {
          queryState.calls.push(["or", filter]);
          return builder;
        }),
        order: vi.fn((column: string, options: unknown) => {
          queryState.calls.push(["order", { column, options }]);
          return builder;
        }),
        range: vi.fn(async (from: number, to: number) => {
          queryState.calls.push(["range", { from, to }]);
          return {
            data: queryState.data.slice(from, to + 1),
            error: queryState.error,
          };
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
    expect(queryState.calls).toContainEqual([
      "or",
      "status.is.null,and(status.neq.Cancelado,status.neq.Completado)",
    ]);
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
    expect(queryState.calls).toContainEqual([
      "or",
      "status.is.null,status.neq.Cancelado",
    ]);
  });

  it("fetches every page with deterministic ordering", async () => {
    queryState.data = Array.from({ length: 501 }, (_, index) => ({
      ...festivalRow,
      id: `festival-${index.toString().padStart(3, "0")}`,
    }));

    await expect(fetchFestivalJobs(false)).resolves.toHaveLength(501);
    expect(queryState.calls.filter(([method]) => method === "range")).toEqual([
      ["range", { from: 0, to: 499 }],
      ["range", { from: 500, to: 999 }],
    ]);
    expect(
      queryState.calls.filter(([method]) => method === "order"),
    ).toContainEqual(["order", { column: "id", options: { ascending: true } }]);
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
