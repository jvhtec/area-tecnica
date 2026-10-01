import { describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const tables = vi.hoisted(() => ({ rows: {} as Record<string, Row[]> }));

vi.mock("@/lib/supabase", () => {
  const from = (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push((row) => row[column] === value);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      gte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) >= value);
        return builder;
      },
      lte: (column: string, value: string) => {
        filters.push((row) => String(row[column]) <= value);
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      // Like PostgREST: never more than max_rows (1000) per response.
      range: (fromRow: number, toRow: number) => {
        const matching = (tables.rows[table] ?? []).filter((row) => filters.every((f) => f(row)));
        return Promise.resolve({ data: matching.slice(fromRow, Math.min(toRow + 1, fromRow + 1000)), error: null });
      },
      then: (resolve: (value: { data: Row[]; error: null }) => unknown) =>
        Promise.resolve({
          data: (tables.rows[table] ?? []).filter((row) => filters.every((f) => f(row))).slice(0, 1000),
          error: null,
        }).then(resolve),
    };
    return builder;
  };
  return { supabase: { from, rpc: () => Promise.resolve({ data: [], error: null }) } };
});

import { fetchMatrixTimesheetAssignments, type MatrixJob } from "@/hooks/useOptimizedMatrixData";

describe("fetchMatrixTimesheetAssignments", () => {
  it("reads every page, so a busy range keeps its later days", async () => {
    const job: MatrixJob = {
      id: "job-1", title: "Gira", start_time: "2026-10-01T08:00:00Z", end_time: "2026-12-31T20:00:00Z",
      status: "Confirmado", job_type: "tour",
    };
    const technicianIds = Array.from({ length: 30 }, (_, i) => `tech-${i}`);
    // 30 technicians x 50 days = 1500 active rows: more than one response.
    tables.rows.timesheets = technicianIds.flatMap((technician_id, t) =>
      Array.from({ length: 50 }, (_, d) => ({
        id: `ts-${t}-${d}`,
        job_id: "job-1",
        technician_id,
        date: `2026-${d < 30 ? "10" : "11"}-${String((d % 30) + 1).padStart(2, "0")}`,
        is_active: true,
        is_schedule_only: false,
        source: "assignment",
      })),
    );
    tables.rows.job_assignments = [];

    const rows = await fetchMatrixTimesheetAssignments({
      jobIds: ["job-1"],
      technicianIds,
      jobsById: new Map([["job-1", job]]),
      startDate: new Date("2026-09-30T12:00:00Z"),
      endDate: new Date("2026-12-31T12:00:00Z"),
    });

    expect(rows).toHaveLength(1500);
  });
});
